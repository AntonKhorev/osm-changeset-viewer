import type {Connection} from './net'
import type {ChangesetViewerDBReader, UserDbRecord} from './db'
import type Grid from './grid'
import type {WorkerBroadcastChannelMessage} from './broadcast-channel'
import {WorkerBroadcastReceiver} from './broadcast-channel'
import installTabDragListeners from './grid-head-drag'
import {ValidUserQuery} from './osm'
import {toUserQuery} from './osm'
import type {MuxBatchItem} from './mux-user-item-db-stream'
import MuxUserItemDbStream from './mux-user-item-db-stream'
import {makeDateOutput} from './date'
import {makeElement, makeDiv, makeLabel, makeLink} from './util/html'
import {makeEscapeTag} from './util/escape'

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

type GridBatchItem = {
	iColumns: number[]
} & MuxBatchItem

class MuxUserItemDbStreamMessenger {
	$adder=makeDiv('adder')()
	watchedUids=new Set<number>()
	constructor(
		private host: string,
		private worker: SharedWorker,
		private stream: MuxUserItemDbStream,
		private receiveBatch: (batch:MuxBatchItem[])=>void
	) {}
	async requestNextBatch(): Promise<void> {
		const action=await this.stream.getNextAction()
		if (action.type=='scan') {
			this.watchedUids.add(action.uid)
			this.worker.port.postMessage({
				type: 'scanUserItems',
				host: this.host,
				start: action.start,
				itemType: action.itemType,
				uid: action.uid,
			})
		} else if (action.type=='batch') {
			this.receiveBatch(action.batch)
		} else if (action.type=='end') {
			this.receiveBatch([])
		}
	}
	async receiveMessage(message: WorkerBroadcastChannelMessage): Promise<void> {
		if (message.type=='scanUserItems') {
			if (message.status=='ready' && this.watchedUids.has(message.uid)) {
				this.watchedUids.delete(message.uid)
				await this.requestNextBatch()
			}
		}
	}
}

export default class GridHead {
	private userEntries=[] as GridUserEntry[]
	private wrappedRemoveUserClickListener: (this:HTMLElement)=>void
	private streamMessenger: MuxUserItemDbStreamMessenger|undefined
	private $tabRow: HTMLTableRowElement
	private $cardRow: HTMLTableRowElement
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
			this.wrappedRemoveUserClickListener=function(){
				that.removeUserClickListener(this)
			}
		}
		if (!grid.$grid.tHead) throw new RangeError(`no table head section`)
		this.$tabRow=grid.$grid.tHead.insertRow()
		this.$cardRow=grid.$grid.tHead.insertRow()
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
		return {
			$tab: this.makeFormTab(),
			$card: this.makeFormCard(),
			type: 'form'
		}
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
		const uidToColumns=new Map<number,number[]>
		for (const [i,entry] of this.userEntries.entries()) {
			if (entry.type!='query') continue
			if (entry.info.status=='failed') {
			} else if (entry.info.status=='ready') {
				const uid=entry.info.user.id
				if (!uidToColumns.has(uid)) {
					uidToColumns.set(uid,[])
				}
				uidToColumns.get(uid)?.push(i)
			} else {
				return
			}
		}
		const stream=new MuxUserItemDbStream(this.db,[...uidToColumns.keys()])
		const streamMessenger=new MuxUserItemDbStreamMessenger(
			this.cx.server.host,this.worker,stream,batch=>{
				this.receiveBatchCallback(
					batch.map((muxBatchItem)=>({...muxBatchItem,iColumns:uidToColumns.get(muxBatchItem.item.uid)??[]}))
				)
			}
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
		$closeButton.addEventListener('click',this.wrappedRemoveUserClickListener)
		return makeDiv('tab')($label,` `,$closeButton)
	}
	private makeFormTab(): HTMLElement {
		const $tab=makeDiv('tab')()
		$tab.append(`Add user`)
		const $closeButton=makeElement('button')('close')('X')
		$closeButton.title=`Remove form`
		$closeButton.innerHTML=`<svg width=16 height=16><use href="#close" /></svg>`
		$closeButton.addEventListener('click',this.wrappedRemoveUserClickListener)
		$tab.append(` `,$closeButton)
		return $tab
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
	private makeFormCard() {
		const $card=makeDiv('card')()
		const $userInput=makeElement('input')()()
		$userInput.type='text'
		$userInput.name='user'
		$userInput.oninput=()=>{
			const query=toUserQuery(this.cx.server.api,this.cx.server.web,$userInput.value)
			if (query.type=='invalid') {
				$userInput.setCustomValidity(query.message)
			} else if (query.type=='empty') {
				$userInput.setCustomValidity(`user query cannot be empty`)
			} else {
				$userInput.setCustomValidity('')
			}
		}
		const $form=makeElement('form')()(
			makeDiv('major-input-group')(
				makeLabel()(
					`Username, URL or #id `,$userInput
				)
			),
			makeDiv('major-input-group')(
				makeElement('button')()(`Add user`)
			)
		)
		$form.onsubmit=async(ev)=>{
			ev.preventDefault()
			const query=toUserQuery(this.cx.server.api,this.cx.server.web,$userInput.value)
			if (query.type=='invalid' || query.type=='empty') return
			const info=await this.getUserInfoForQuery(query)
			const userEntry=this.findUserEntryByCard($card)
			if (!userEntry) return
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
		}
		$card.append($form)
		return $card
	}
	private findUserEntryByCard($card: HTMLElement): GridUserEntry|undefined {
		for (const userEntry of this.userEntries) {
			if (userEntry.$card==$card) return userEntry
		}
	}
	private removeUserClickListener($button: HTMLElement): void {
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
			$tab: HTMLElement,
			$card: HTMLElement
		}[] = []
		for (const {$tab,$card} of this.userEntries) {
			const $tabCell=makeElement('th')()($tab)
			const $cardCell=makeElement('td')()($card)
			this.$tabRow.append($tabCell)
			this.$cardRow.append($cardCell)
			tabDragElements.push({$tabCell,$tab,$card})
		}
		for (const iActive of tabDragElements.keys()) {
			installTabDragListeners(this.grid.$grid,tabDragElements,iActive)
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
