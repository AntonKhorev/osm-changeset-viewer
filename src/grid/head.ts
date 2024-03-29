import type {Connection} from '../net'
import type {ChangesetViewerDBReader, UserDbRecord, UserScanDbRecord} from '../db'
import {WorkerBroadcastReceiver} from '../broadcast-channel'
import TabDragListener from './head-drag'
import type {UserInfo, CompleteUserInfo} from './head-item'
import {
	makeAllTab,
	makeUserTab, makeUserCard, makeUserSelector, updateUserCard,
	makeFormTab, makeFormCard, makeFormSelector
} from './head-item'
import {writeHueAttributes} from './info'
import type Colorizer from '../colorizer'
import type {ValidUserQuery} from '../osm'
import {toUserQuery} from '../osm'
import MuxUserItemDbStream from '../mux-user-item-db-stream'
import type {GridBatchItem} from '../mux-user-item-db-stream-messenger'
import MuxUserItemDbStreamMessenger from '../mux-user-item-db-stream-messenger'
import {makeElement, makeDiv} from '../util/html'
import {makeEscapeTag} from '../util/escape'
import {moveInArray} from '../util/types'

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
		info: UserInfo
		$displayedChangesetsCount: HTMLOutputElement
		displayedChangesetsCount: number
		$displayedNotesCount: HTMLOutputElement
		displayedNotesCount: number
	}
)

export default class GridHead {
	$gridHead=makeElement('thead')()()
	private userEntries=[] as GridUserEntry[]
	private wrappedRemoveColumnClickListener: (this:HTMLElement)=>void
	private streamMessenger: MuxUserItemDbStreamMessenger|undefined
	private $tabRow: HTMLTableRowElement
	private $cardRow: HTMLTableRowElement
	private $selectorRow: HTMLTableRowElement
	private $adderCell: HTMLTableCellElement
	constructor(
		private colorizer: Colorizer,
		private cx: Connection,
		private db: ChangesetViewerDBReader,
		private worker: SharedWorker,
		// former direct grid method calls:
		private setColumns: (columnUids:(number|undefined)[])=>void,
		private reorderColumns: (iShiftFrom:number,iShiftTo:number)=>void,
		private getColumnCheckboxStatuses: ()=>[
			hasChecked: boolean[],
			hasUnchecked: boolean[],
			selectedChangesetIds: Set<number>[]
		],
		private triggerColumnCheckboxes: (iColumn: number, isChecked: boolean)=>void,
		private changeUidHue: (uid: number)=>void,
		// former main callbacks:
		private sendUpdatedUserQueriesReceiver: (userQueries: ValidUserQuery[])=>void,
		private restartStreamCallback: ()=>void,
		private readyStreamCallback: (
			requestNextBatch: ()=>void
		) => void,
		private receiveBatchCallback: (
			batch: Iterable<GridBatchItem>,
			usernames: Map<number,string>
		) => void
	) {
		{
			const that=this
			this.wrappedRemoveColumnClickListener=function(){
				that.removeColumnClickListener(this)
			}
		}
		this.$tabRow=this.$gridHead.insertRow()
		this.$cardRow=this.$gridHead.insertRow()
		this.$selectorRow=this.$gridHead.insertRow()
		this.$selectorRow.classList.add('selectors')
		this.$adderCell=makeElement('th')('all')()
		this.$tabRow.append(this.$adderCell)
		const $adderButton=makeElement('button')()(`+`)
		$adderButton.onclick=()=>{
			const formEntry=this.makeFormUserEntry()
			this.userEntries.push(formEntry)
			// this.appendUserEntryToHead(formEntry)
			this.rewriteUserEntriesInHead()
			this.restartStream()
		}
		this.$adderCell.append(makeDiv('tab')($adderButton))
		const broadcastReceiver=new WorkerBroadcastReceiver(cx.server.host)
		broadcastReceiver.onmessage=async({data:message})=>{
			if (message.type!='operation') return
			const replaceUserCard=(userEntry:Extract<GridUserEntry,{type:'query'}>)=>{
				const {$tab,$card,$selector}=userEntry
				const uid=getUserEntryUid(userEntry)
				if ($tab.parentElement) writeHueAttributes(colorizer,$tab.parentElement,uid)
				if ($card.parentElement) writeHueAttributes(colorizer,$card.parentElement,uid)
				if ($selector.parentElement) writeHueAttributes(colorizer,$selector.parentElement,uid)
				this.updateUserCard($card,userEntry.info)
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
	async addUserQueries(userQueries: ValidUserQuery[]): Promise<void> {
		for (const query of userQueries) {
			const entry=await this.makeQueryUserEntry(query)
			this.userEntries.push(entry)
		}
		this.rewriteUserEntriesInHead()
		this.sendUpdatedUserQueries()
		this.restartStream()
	}
	updateSelectors(): void {
		const updateCheckboxState=($checkbox: HTMLInputElement, checked: boolean, unchecked: boolean)=>{
			$checkbox.checked=(checked && !unchecked)
			$checkbox.indeterminate=(checked && unchecked)
		}
		const [hasChecked,hasUnchecked,selectedChangesetIds]=this.getColumnCheckboxStatuses()
		for (const [iColumn,{$selector}] of this.userEntries.entries()) {
			const $checkbox=$selector.querySelector('input[type=checkbox]')
			if ($checkbox instanceof HTMLInputElement) {
				updateCheckboxState($checkbox,hasChecked[iColumn],hasUnchecked[iColumn])
			}
			const $count=$selector.querySelector('output')
			if ($count) {
				if (selectedChangesetIds[iColumn].size==0) {
					$count.replaceChildren()
				} else {
					$count.replaceChildren(
						`${selectedChangesetIds[iColumn].size} selected`
					)
				}
			}
		}
		{
			const $checkbox=this.$selectorRow.querySelector(':scope > td:first-child input[type=checkbox]')
			if ($checkbox instanceof HTMLInputElement) {
				updateCheckboxState($checkbox,hasChecked.some(v=>v),hasUnchecked.some(v=>v))
			}
		}
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
		const $displayedChangesetsCount=this.makeUserDisplayedItemsCount()
		const $displayedNotesCount=this.makeUserDisplayedItemsCount()
		const $card=makeUserCard(
			this.colorizer,
			$displayedChangesetsCount,$displayedNotesCount,
			()=>this.sendUserQueryToWorker(query),
			(type,uid)=>this.sendRescanRequestToWorker(type,uid),
			(uid)=>{
				this.changeUidHuePickerValue(uid)
				this.changeUidHue(uid)
			}
		)
		this.updateUserCard($card,info)
		const $selector=makeUserSelector($checkbox=>{
			for (const [iColumn,userEntry] of this.userEntries.entries()) {
				if ($selector!=userEntry.$selector) continue
				this.triggerColumnCheckboxes(iColumn,$checkbox.checked)
			}
		})
		return {
			$tab,$card,$selector,
			type: 'query',
			query,info,
			$displayedChangesetsCount, displayedChangesetsCount: 0,
			$displayedNotesCount, displayedNotesCount: 0,
		}
	}
	private updateUserCard($card: HTMLElement, info: UserInfo): void {
		updateUserCard(
			this.colorizer,
			$card,info,
			name=>this.cx.server.web.getUrl(e`user/${name}`),
			id=>this.cx.server.api.getUrl(e`user/${id}.json`)
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
		for (const entry of this.userEntries) {
			if (entry.type!='query') continue
			entry.$displayedChangesetsCount.textContent=String(
				entry.displayedChangesetsCount=0
			)
			entry.$displayedNotesCount.textContent=String(
				entry.displayedNotesCount=0
			)
		}
		const columnUids=this.userEntries.map(getUserEntryUid)
		this.setColumns(columnUids)
		this.streamMessenger=undefined
		this.restartStreamCallback()
		this.startStreamIfNotStartedAndGotAllUids()
	}
	private startStreamIfNotStartedAndGotAllUids() {
		if (this.streamMessenger) return
		const users=new Map<number,UserDbRecord>()
		const columnUids: (number|undefined)[] = []
		for (const entry of this.userEntries) {
			if (entry.type!='query' || entry.info.status=='failed') {
				columnUids.push(undefined)
			} else if (entry.info.status=='ready') {
				users.set(entry.info.user.id,entry.info.user)
				columnUids.push(entry.info.user.id)
			} else {
				return
			}
		}
		this.setColumns(columnUids)
		const stream=new MuxUserItemDbStream(this.db,[...users.values()])
		const streamMessenger=new MuxUserItemDbStreamMessenger(
			this.cx.server.host,this.worker,stream,columnUids,(batch,usernames)=>{
				for (const {iColumns,type} of batch) {
					for (const iColumn of iColumns) {
						const userEntry=this.userEntries[iColumn]
						if (!userEntry || userEntry.type!='query') continue
						if (type=='changeset') {
							userEntry.$displayedChangesetsCount.textContent=String(
								++userEntry.displayedChangesetsCount
							)
						} else if (type=='note') {
							userEntry.$displayedNotesCount.textContent=String(
								++userEntry.displayedNotesCount
							)
						}
					}
				}
				this.receiveBatchCallback(batch,usernames)
				this.updateSelectors()
			}
		)
		this.readyStreamCallback(async()=>{
			await streamMessenger.requestNextBatch()
		})
		this.streamMessenger=streamMessenger
	}
	private makeUserDisplayedItemsCount(): HTMLOutputElement {
		const $count=makeElement('output')()(`???`)
		$count.title=`displayed`
		return $count
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
	private sendRescanRequestToWorker(type: UserScanDbRecord['type'], uid: number): void {
		this.worker.port.postMessage({
			type: 'scanUserItems',
			host: this.cx.server.host,
			start: true,
			itemType: type,
			uid: uid,
		})
	}
	// private appendUserEntryToHead(userEntry: GridUserEntry): void {
	// 	this.$tabRow.append(userEntry.$tab) // TODO make table cells
	// 	this.$adderCell.before(userEntry.$card)
	// }
	private rewriteUserEntriesInHead(): void {
		const $allTabCell=makeElement('th')('all')(makeAllTab())
		writeHueAttributes(this.colorizer,$allTabCell,undefined)
		this.$tabRow.replaceChildren($allTabCell)
		const $allCardCell=makeElement('td')('all')()
		writeHueAttributes(this.colorizer,$allCardCell,undefined)
		this.$cardRow.replaceChildren($allCardCell)
		const $allSelectorCell=makeElement('td')('all')(
			makeUserSelector($checkbox=>{
				const checked=$checkbox.checked
				for (const iColumn of this.userEntries.keys()) {
					this.triggerColumnCheckboxes(iColumn,checked)
				}
			})
		)
		writeHueAttributes(this.colorizer,$allSelectorCell,undefined)
		this.$selectorRow.replaceChildren($allSelectorCell)
		const gridHeadCells: {
			$tabCell: HTMLTableCellElement
			$cardCell: HTMLTableCellElement
			$selectorCell: HTMLTableCellElement
		}[] = []
		for (const userEntry of this.userEntries) {
			const {$tab,$card,$selector}=userEntry
			const $tabCell=makeElement('th')()($tab)
			const $cardCell=makeElement('td')()($card)
			const $selectorCell=makeElement('td')()($selector)
			const uid=getUserEntryUid(userEntry)
			writeHueAttributes(this.colorizer,$tabCell,uid)
			writeHueAttributes(this.colorizer,$cardCell,uid)
			writeHueAttributes(this.colorizer,$selectorCell,uid)
			this.$tabRow.append($tabCell)
			this.$cardRow.append($cardCell)
			this.$selectorRow.append($selectorCell)
			gridHeadCells.push({$tabCell,$cardCell,$selectorCell})
		}
		for (const [iActive,{$tab}] of this.userEntries.entries()) {
			new TabDragListener(this.$gridHead,gridHeadCells,$tab,iActive,iShiftTo=>{
				moveInArray(this.userEntries,iActive,iShiftTo)
				this.rewriteUserEntriesInHead()
				this.sendUpdatedUserQueries()
				this.reorderColumns(iActive,iShiftTo)
				this.streamMessenger?.reorderColumns(iActive,iShiftTo)
			}).install()
		}
		this.$tabRow.append(this.$adderCell)
	}
	private changeUidHuePickerValue(uid: number): void {
		for (const userEntry of this.userEntries) {
			if (userEntry.type!='query') continue
			if (userEntry.info.status!='ready' && userEntry.info.status!='rerunning') continue
			if (userEntry.info.user.id!=uid) continue
			this.updateUserCard(userEntry.$card,userEntry.info)
		}
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

function getUserEntryUid(userEntry: GridUserEntry): number|undefined {
	return (userEntry.type=='query'&&(userEntry.info.status=='ready'||userEntry.info.status=='rerunning')
		? userEntry.info.user.id
		: undefined
	)
}
