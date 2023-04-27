import type {Connection} from './net'
import type {ChangesetViewerDBReader} from './db'
import type Grid from './grid'
import {WorkerBroadcastReceiver} from './broadcast-channel'
import installTabDragListeners from './grid-head-drag'
import type {UserInfo, CompleteUserInfo} from './grid-head-item'
import {
	makeUserTab, makeUserCard, makeUserSelector,
	makeFormTab, makeFormCard, makeFormSelector
} from './grid-head-item'
import {ValidUserQuery} from './osm'
import {toUserQuery} from './osm'
import MuxUserItemDbStream from './mux-user-item-db-stream'
import type {GridBatchItem} from './mux-user-item-db-stream-messenger'
import MuxUserItemDbStreamMessenger from './mux-user-item-db-stream-messenger'
import {makeElement} from './util/html'
import {makeEscapeTag} from './util/escape'
import {moveInArray} from './util/types'

const e=makeEscapeTag(encodeURIComponent)

type GridUserEntry = { // TODO change to column entry
	$tab: HTMLElement
	$card: HTMLElement
	$selector: HTMLElement
} & (
	{
		type: 'form'
	} | {
		type: 'query'
		query: ValidUserQuery
		$downloadedChangesetsCount: HTMLOutputElement // TODO change to visible changeset count
		info: UserInfo
	}
)

export default class GridHead {
	private userEntries=[] as GridUserEntry[]
	private wrappedRemoveColumnClickListener: (this:HTMLElement)=>void
	private streamMessenger: MuxUserItemDbStreamMessenger|undefined
	private $tabRow: HTMLTableRowElement
	private $cardRow: HTMLTableRowElement
	private $selectorRow: HTMLTableRowElement
	private $adderCell: HTMLTableCellElement
	constructor(
		private cx: Connection,
		private db: ChangesetViewerDBReader,
		private worker: SharedWorker,
		private grid: Grid,
		private sendUpdatedUserQueriesReceiver: (userQueries: ValidUserQuery[])=>void,
		private restartStreamCallback: ()=>void,
		private readyStreamCallback: (
			requestNextBatch: ()=>void
		) => void,
		private receiveBatchCallback: (
			batch: Iterable<GridBatchItem>
		) => void
	) {
		{
			const that=this
			this.wrappedRemoveColumnClickListener=function(){
				that.removeColumnClickListener(this)
			}
		}
		if (!grid.$grid.tHead) throw new RangeError(`no table head section`)
		this.$tabRow=grid.$grid.tHead.insertRow()
		this.$cardRow=grid.$grid.tHead.insertRow()
		this.$selectorRow=grid.$grid.tHead.insertRow()
		this.$selectorRow.classList.add('selectors')
		this.$adderCell=this.$cardRow.insertCell()
		this.$adderCell.classList.add('adder')
		const $adderButton=makeElement('button')()(`+`)
		$adderButton.onclick=()=>{
			const formEntry=this.makeFormUserEntry()
			this.userEntries.push(formEntry)
			// this.appendUserEntryToHead(formEntry)
			this.rewriteUserEntriesInHead()
			this.restartStream()
		}
		this.$adderCell.append($adderButton)
		const broadcastReceiver=new WorkerBroadcastReceiver(cx.server.host)
		broadcastReceiver.onmessage=async({data:message})=>{
			if (message.type!='operation') return
			const replaceUserCard=(userEntry:Extract<GridUserEntry,{type:'query'}>)=>{
				const $card=this.makeUserCard(
					userEntry.query,userEntry.info,userEntry.$downloadedChangesetsCount
				)
				// userEntry.$card.replaceWith($card)
				userEntry.$card=$card
				this.rewriteUserEntriesInHead()
				const columnHues=this.userEntries.map(getUserEntryHue)
				this.grid.setColumnHues(columnHues)
			}
			if (message.part.type=='getUserInfo') {
				for (const userEntry of this.userEntries) {
					if (userEntry.type!='query') continue
					if (!isSameQuery(userEntry.query,message.part.query)) continue
					if (message.part.status=='running') {
						if (userEntry.info.status=='rerunning' || userEntry.info.status=='ready') {
							userEntry.info={
								status: 'rerunning',
								user: userEntry.info.user,
								scans: userEntry.info.scans
							}
						} else {
							userEntry.info={status:message.part.status}
						}
					} else if (message.part.status=='failed') {
						userEntry.info={status:message.part.status}
					} else if (message.part.status=='ready') {
						const info=await this.askDbForUserInfo(message.part.query)
						if (info) {
							userEntry.info=info
						} else {
							userEntry.info={
								status: 'failed'
							}
						}
					} else {
						continue
					}
					replaceUserCard(userEntry)
				}
				this.startStreamIfNotStartedAndGotAllUids()
			} else if (message.part.type=='scanUserItems' && message.part.status=='ready') {
				for (const userEntry of this.userEntries) {
					if (userEntry.type!='query') continue
					if (userEntry.info.status!='ready') continue
					if (userEntry.info.user.id!=message.part.uid) continue
					const info=await this.askDbForUserInfo({type:'id',uid:message.part.uid})
					if (info) {
						userEntry.info=info
						replaceUserCard(userEntry)
					}
				}
			}
			if (this.streamMessenger) {
				await this.streamMessenger.receiveMessage(message.part)
			}
		}
	}
	async receiveUpdatedUserQueries(userQueries: ValidUserQuery[]): Promise<void> {
		const newUserEntries=[] as GridUserEntry[]
		if (userQueries.length==0) {
			newUserEntries.push(
				this.makeFormUserEntry()
			)
		} else {
			for (const query of userQueries) {
				let entry=this.pickFromExistingUserEntries(query)
				if (!entry) {
					entry=await this.makeQueryUserEntry(query)
				}
				newUserEntries.push(entry)
			}
		}
		this.userEntries=newUserEntries
		this.rewriteUserEntriesInHead()
		this.restartStream()
	}
	private async makeQueryUserEntry(query: ValidUserQuery): Promise<GridUserEntry> {
		let info: UserInfo|undefined = await this.askDbForUserInfo(query)
		if (!info) {
			this.sendUserQueryToWorker(query)
			info={status:'pending'}
		}
		const $tab=makeUserTab(
			this.wrappedRemoveColumnClickListener,query
		)
		const $downloadedChangesetsCount=this.makeUserDownloadedChangesetsCount()
		const $card=this.makeUserCard(
			query,info,$downloadedChangesetsCount
		)
		const $selector=makeUserSelector()
		return {
			$tab,$card,$selector,
			type: 'query',
			query,$downloadedChangesetsCount,info
		}
	}
	private makeUserCard(
		query: ValidUserQuery, info: UserInfo, $downloadedChangesetsCount: HTMLOutputElement
	): HTMLElement {
		return makeUserCard(
			query,info,$downloadedChangesetsCount,
			name=>this.cx.server.web.getUrl(e`user/${name}`),
			id=>this.cx.server.api.getUrl(e`user/${id}.json`),
			query=>this.sendUserQueryToWorker(query),
			type=>{
				console.log(`TODO rescan ${type}`) ///
				// kill user data so that stream can't be restarted
				// kill stream
				// send request to worker to discard existing scan
			}
		)
	}
	private makeFormUserEntry(): GridUserEntry {
		const userEntry: GridUserEntry = {
			$tab: makeFormTab(
				this.wrappedRemoveColumnClickListener
			),
			$card: makeFormCard(value=>{
				return toUserQuery(this.cx.server.api,this.cx.server.web,value)
			},async(query)=>{
				const newUserEntry=await this.makeQueryUserEntry(query)
				// userEntry.$tab.replaceWith($newTab)
				// userEntry.$card.replaceWith($newCard)
				Object.assign(userEntry,newUserEntry)
				this.rewriteUserEntriesInHead()
				this.sendUpdatedUserQueries()
				this.restartStream()
			}),
			$selector: makeFormSelector(),
			type: 'form'
		}
		return userEntry
	}
	private async askDbForUserInfo(query: ValidUserQuery): Promise<CompleteUserInfo|undefined> {
		if (query.type=='name') {
			const info=await this.db.getUserInfoByName(query.username)
			if (info) return {status:'ready',...info}
		} else if (query.type=='id') {
			const info=await this.db.getUserInfoById(query.uid)
			if (info) return {status:'ready',...info}
		}
	}
	private pickFromExistingUserEntries(query: ValidUserQuery): GridUserEntry|null {
		for (const [i,entry] of this.userEntries.entries()) {
			if (entry.type!='query') continue
			if (isSameQuery(query,entry.query)) {
				this.userEntries.splice(i,1)
				return entry
			}
		}
		return null
	}
	private restartStream() {
		const columnHues=this.userEntries.map(getUserEntryHue)
		this.grid.setColumns(columnHues)
		this.streamMessenger=undefined
		this.restartStreamCallback()
		this.startStreamIfNotStartedAndGotAllUids()
	}
	private startStreamIfNotStartedAndGotAllUids() {
		if (this.streamMessenger) return
		const uids=new Set<number>()
		const columnUids: (number|null)[] = []
		for (const entry of this.userEntries) {
			if (entry.type!='query' || entry.info.status=='failed') {
				columnUids.push(null)
			} else if (entry.info.status=='ready') {
				uids.add(entry.info.user.id)
				columnUids.push(entry.info.user.id)
			} else {
				return
			}
		}
		const stream=new MuxUserItemDbStream(this.db,uids)
		const streamMessenger=new MuxUserItemDbStreamMessenger(
			this.cx.server.host,this.worker,stream,columnUids,this.receiveBatchCallback
		)
		this.readyStreamCallback(async()=>{
			await streamMessenger.requestNextBatch()
		})
		this.streamMessenger=streamMessenger
	}
	private makeUserDownloadedChangesetsCount(): HTMLOutputElement {
		const $downloadedChangesetsCount=makeElement('output')()(`???`)
		$downloadedChangesetsCount.title=`downloaded`
		return $downloadedChangesetsCount
	}
	private removeColumnClickListener($button: HTMLElement): void {
		const $tab=$button.closest('.tab')
		for (const [i,entry] of this.userEntries.entries()) {
			if (entry.$tab!=$tab) continue
			this.userEntries.splice(i,1)
			// entry.$tab.remove() // TODO rewrite
			// entry.$card.remove()
			this.rewriteUserEntriesInHead()
			this.sendUpdatedUserQueries()
			this.restartStream()
			break
		}
	}
	private sendUpdatedUserQueries(): void {
		this.sendUpdatedUserQueriesReceiver(
			this.userEntries.flatMap(entry=>entry.type=='query'?[entry.query]:[])
		)
	}
	private sendUserQueryToWorker(query: ValidUserQuery) {
		this.worker.port.postMessage({
			type: 'getUserInfo',
			host: this.cx.server.host,
			query
		})
	}
	// private appendUserEntryToHead(userEntry: GridUserEntry): void {
	// 	this.$tabRow.append(userEntry.$tab) // TODO make table cells
	// 	this.$adderCell.before(userEntry.$card)
	// }
	private rewriteUserEntriesInHead(): void {
		this.$tabRow.replaceChildren()
		this.$cardRow.replaceChildren()
		this.$selectorRow.replaceChildren()
		const tabDragElements: {
			$tabCell: HTMLTableCellElement,
			$cardCell: HTMLTableCellElement,
			$selectorCell: HTMLTableCellElement,
			$tab: HTMLElement,
			$card: HTMLElement,
			$selector: HTMLElement
		}[] = []
		for (const userEntry of this.userEntries) {
			const {$tab,$card,$selector}=userEntry
			const $tabCell=makeElement('th')()($tab)
			const $cardCell=makeElement('td')()($card)
			const $selectorCell=makeElement('td')()($selector)
			const hue=getUserEntryHue(userEntry)
			if (hue!=null) {
				$tabCell.style.setProperty('--hue',String(hue))
				$cardCell.style.setProperty('--hue',String(hue))
				$selectorCell.style.setProperty('--hue',String(hue))
			}
			this.$tabRow.append($tabCell)
			this.$cardRow.append($cardCell)
			this.$selectorRow.append($selectorCell)
			tabDragElements.push({$tabCell,$cardCell,$selectorCell,$tab,$card,$selector})
		}
		for (const iActive of tabDragElements.keys()) {
			installTabDragListeners(this.grid.$grid,tabDragElements,iActive,iShiftTo=>{
				moveInArray(this.userEntries,iActive,iShiftTo)
				this.rewriteUserEntriesInHead()
				this.sendUpdatedUserQueries()
				this.grid.reorderColumns(iActive,iShiftTo)
				this.streamMessenger?.reorderColumns(iActive,iShiftTo)
			})
		}
		this.$cardRow.append(this.$adderCell)
	}
}

function isSameQuery(query1: ValidUserQuery, query2: ValidUserQuery): boolean {
	if (query1.type=='id') {
		if (query2.type!=query1.type) return false
		return query1.uid==query2.uid
	} else if (query1.type=='name') {
		if (query2.type!=query1.type) return false
		return query1.username==query2.username
	} else {
		return false
	}
}

function getUserEntryHue(userEntry: GridUserEntry): number|null {
	return (userEntry.type=='query'&&(userEntry.info.status=='ready'||userEntry.info.status=='rerunning')
		? userEntry.info.user.id % 360
		: null
	)
}
