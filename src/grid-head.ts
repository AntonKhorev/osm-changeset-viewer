import type {Connection} from './net'
import type {ChangesetViewerDBReader, UserDbRecord} from './db'
import type Grid from './grid'
import {WorkerBroadcastReceiver} from './broadcast-channel'
import installTabDragListeners from './grid-head-drag'
import {makeFormTab, makeFormCard} from './grid-head-item'
import {ValidUserQuery} from './osm'
import {toUserQuery} from './osm'
import MuxUserItemDbStream from './mux-user-item-db-stream'
import type {GridBatchItem} from './mux-user-item-db-stream-messenger'
import MuxUserItemDbStreamMessenger from './mux-user-item-db-stream-messenger'
import {makeDateOutput} from './date'
import {makeElement, makeDiv, makeLink} from './util/html'
import {makeEscapeTag} from './util/escape'
import {moveInArray} from './util/types'

const e=makeEscapeTag(encodeURIComponent)

type UserInfo = {
	status: 'pending'|'running'|'failed'
} | {
	status: 'ready'
	user: UserDbRecord
}

type GridUserEntry = {
	$tab: HTMLElement
	$card: HTMLElement
	// $selector: HTMLElement
} & (
	{
		type: 'form'
	} | {
		type: 'query'
		query: ValidUserQuery
		$downloadedChangesetsCount: HTMLOutputElement
		info: UserInfo
	}
)

export default class GridHead {
	private userEntries=[] as GridUserEntry[]
	private wrappedRemoveColumnClickListener: (this:HTMLElement)=>void
	private streamMessenger: MuxUserItemDbStreamMessenger|undefined
	private $tabRow: HTMLTableRowElement
	private $cardRow: HTMLTableRowElement
	// private $selectorRow: HTMLTableRowElement
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
		// this.$selectorRow=grid.$grid.tHead.insertRow()
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
			if (message.type=='getUserInfo') {
				for (const userEntry of this.userEntries) {
					if (userEntry.type!='query') continue
					if (!isSameQuery(userEntry.query,message.query)) continue
					if (message.status=='running' || message.status=='failed') { // TODO maybe skip running?
						userEntry.info={status:message.status}
					} else if (message.status=='ready') {
						userEntry.info={
							status: message.status,
							user: message.user
						}
					} else {
						continue
					}
					const $card=this.makeUserCard(userEntry.query,userEntry.info,userEntry.$downloadedChangesetsCount)
					userEntry.$card.replaceWith($card)
					userEntry.$card=$card
				}
				this.startStreamIfNotStartedAndGotAllUids()
			}
			if (this.streamMessenger) {
				await this.streamMessenger.receiveMessage(message)
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
					const info=await this.getUserInfoForQuery(query)
					const $tab=this.makeUserTab(query)
					const $downloadedChangesetsCount=this.makeUserDownloadedChangesetsCount()
					const $card=this.makeUserCard(query,info,$downloadedChangesetsCount)
					entry={
						$tab,$card,
						type: 'query',
						query,$downloadedChangesetsCount,info
					}
				}
				newUserEntries.push(entry)
			}
		}
		this.userEntries=newUserEntries
		this.rewriteUserEntriesInHead()
		this.restartStream()
	}
	private makeFormUserEntry(): GridUserEntry {
		const userEntry: GridUserEntry = {
			$tab: makeFormTab(
				this.wrappedRemoveColumnClickListener
			),
			$card: makeFormCard(value=>{
				return toUserQuery(this.cx.server.api,this.cx.server.web,value)
			},async(query)=>{
				const info=await this.getUserInfoForQuery(query)
				const $newTab=this.makeUserTab(query)
				const $downloadedChangesetsCount=this.makeUserDownloadedChangesetsCount()
				const $newCard=this.makeUserCard(query,info,$downloadedChangesetsCount)
				// userEntry.$tab.replaceWith($newTab)
				// userEntry.$card.replaceWith($newCard)
				const newUserEntry:GridUserEntry={
					$tab: $newTab,
					$card: $newCard,
					type: 'query',
					query,$downloadedChangesetsCount,info
				}
				Object.assign(userEntry,newUserEntry)
				this.rewriteUserEntriesInHead()
				this.sendUpdatedUserQueries()
				this.restartStream()
			}),
			type: 'form'
		}
		return userEntry
	}
	private async getUserInfoForQuery(query: ValidUserQuery): Promise<UserInfo> {
		if (query.type=='name') {
			const user=await this.db.getUserByName(query.username)
			if (user) return {status:'ready',user}
		} else if (query.type=='id') {
			const user=await this.db.getUserById(query.uid)
			if (user) return {status:'ready',user}
		}
		this.sendUserQueryToWorker(query)
		return {status:'pending'}
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
		const columnHues=this.userEntries.map(userEntry=>userEntry.type=='query'&&userEntry.info.status=='ready'
			? userEntry.info.user.id % 360
			: null
		)
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
	private makeUserTab(query: ValidUserQuery): HTMLElement {
		const $label=makeElement('span')('label')()
		if (query.type=='id') {
			$label.append(`#${query.uid}`)
		} else {
			$label.append(query.username)
		}
		const $closeButton=makeElement('button')('close')('X')
		$closeButton.title=`Remove user`
		$closeButton.innerHTML=`<svg width=16 height=16><use href="#close" /></svg>`
		$closeButton.addEventListener('click',this.wrappedRemoveColumnClickListener)
		return makeDiv('tab')($label,` `,$closeButton)
	}
	private makeUserDownloadedChangesetsCount(): HTMLOutputElement {
		const $downloadedChangesetsCount=makeElement('output')()(`???`)
		$downloadedChangesetsCount.title=`downloaded`
		return $downloadedChangesetsCount
	}
	private makeUserCard(query: ValidUserQuery, info: UserInfo, $downloadedChangesetsCount: HTMLOutputElement): HTMLElement {
		const $card=makeDiv('card')()
		if (info.status=='pending' || info.status=='running') {
			$card.append(makeDiv('notice')(`waiting for user data`))
		} else if (info.status!='ready') {
			$card.append(makeDiv('notice')(`unable to get user data`))
		} else {
			const $totalChangesetsCount=makeElement('output')()()
			const $updateButton=makeElement('button')()(`Update user info`)
			if (info.user.visible) {
				$totalChangesetsCount.append(String(info.user.changesets.count))
				$totalChangesetsCount.title=`opened by the user`
			} else {
				$totalChangesetsCount.append(`???`)
				$totalChangesetsCount.title=`number of changesets opened by the user is unknown because the user is deleted`
			}
			$card.append(
				makeDiv('name')(
					(info.user.visible
						? makeLink(info.user.name,this.cx.server.web.getUrl(e`user/${info.user.name}`))
						: `deleted user`
					),` `,
					makeElement('span')('uid')(
						`(`,makeLink(`#${info.user.id}`,this.cx.server.api.getUrl(e`user/${info.user.id}.json`)),`)`
					)
				)
			)
			if (info.user.visible) {
				$card.append(
					makeDiv('created')(
						`created at `,makeDateOutput(info.user.createdAt)
					)
				)
			} else {
				const $unknown=makeElement('span')()(`???`)
				$unknown.title=`date is unknown because the user is deleted`
				$card.append(
					makeDiv('created')(
						`created at `,$unknown
					)
				)
			}
			$card.append(
				makeDiv('changesets')(
					`changesets: `,$downloadedChangesetsCount,` / `,$totalChangesetsCount
				),
				makeDiv('updated')(
					`user info updated at `,makeDateOutput(info.user.infoUpdatedAt),` `,$updateButton
				)
			)
			$updateButton.onclick=()=>{
				this.sendUserQueryToWorker(query)
			}
		}
		return $card
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
		const tabDragElements: {
			$tabCell: HTMLTableCellElement,
			$cardCell: HTMLTableCellElement,
			$tab: HTMLElement,
			$card: HTMLElement
		}[] = []
		for (const {$tab,$card} of this.userEntries) {
			const $tabCell=makeElement('th')()($tab)
			const $cardCell=makeElement('td')()($card)
			this.$tabRow.append($tabCell)
			this.$cardRow.append($cardCell)
			tabDragElements.push({$tabCell,$cardCell,$tab,$card})
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
