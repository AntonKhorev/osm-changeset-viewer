import type {Connection} from './net'
import type {ChangesetViewerDBReader, UserDbRecord, ChangesetDbRecord} from './db'
import type Grid from './grid'
import type {WorkerBroadcastChannelMessage} from './broadcast-channel'
import {WorkerBroadcastReceiver} from './broadcast-channel'
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
	query: ValidUserQuery
	$downloadedChangesetsCount: HTMLOutputElement
	$tab: HTMLElement
	$card: HTMLElement
	info: UserInfo
}

type GridBatchItem = {
	iColumns: number[]
} & MuxBatchItem

class MuxUserItemDbStreamMessenger {
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
	private $formCap=makeDiv('form-cap')(`Add a user`)
	private $form=makeElement('form')()()
	private wrappedRemoveUserClickListener: (this:HTMLElement)=>void
	private streamMessenger: MuxUserItemDbStreamMessenger|undefined
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
		this.$formCap.style.gridRow='1'
		const $userInput=makeElement('input')()()
		$userInput.type='text'
		$userInput.name='user'
		this.$form.append(
			makeDiv('major-input-group')(
				makeLabel()(
					`Username, URL or #id `,$userInput
				)
			),
			makeDiv('major-input-group')(
				makeElement('button')()(`Add user`)
			)
		)
		this.$form.style.gridRow='2'
		this.grid.$grid.append(this.$formCap,this.$form)
		$userInput.oninput=()=>{
			const query=toUserQuery(cx.server.api,cx.server.web,$userInput.value)
			if (query.type=='invalid') {
				$userInput.setCustomValidity(query.message)
			} else if (query.type=='empty') {
				$userInput.setCustomValidity(`user query cannot be empty`)
			} else {
				$userInput.setCustomValidity('')
			}
		}
		this.$form.onsubmit=async(ev)=>{
			ev.preventDefault()
			const query=toUserQuery(cx.server.api,cx.server.web,$userInput.value)
			if (query.type=='invalid' || query.type=='empty') return
			const info=await this.getUserInfoForQuery(query)
			const $tab=this.makeUserTab(query)
			const $downloadedChangesetsCount=this.makeUserDownloadedChangesetsCount()
			const $card=this.makeUserCard(query,info,$downloadedChangesetsCount)
			this.userEntries.push({query,$tab,$card,$downloadedChangesetsCount,info})
			this.sendUpdatedUserQueries()
			this.$formCap.before($tab)
			this.$form.before($card)
			this.restartStream()
		}
		const broadcastReceiver=new WorkerBroadcastReceiver(cx.server.host)
		broadcastReceiver.onmessage=async({data:message})=>{
			if (message.type=='getUserInfo') {
				for (const userEntry of this.userEntries) {
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
		{
			const newUserEntries=[] as GridUserEntry[]
			for (const query of userQueries) {
				let entry=this.pickFromExistingUserEntries(query)
				if (!entry) {
					const info=await this.getUserInfoForQuery(query)
					const $tab=this.makeUserTab(query)
					const $downloadedChangesetsCount=this.makeUserDownloadedChangesetsCount()
					const $card=this.makeUserCard(query,info,$downloadedChangesetsCount)
					entry={query,$tab,$card,$downloadedChangesetsCount,info}
				}
				newUserEntries.push(entry)
			}
			for (const {$tab,$card} of this.userEntries) {
				$tab.remove()
				$card.remove()
			}
			this.userEntries=newUserEntries
		}
		this.$formCap.before(...this.userEntries.map(({$tab})=>$tab))
		this.$form.before(...this.userEntries.map(({$card})=>$card))
		this.restartStream()
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
			if (isSameQuery(query,entry.query)) {
				this.userEntries.splice(i,1)
				return entry
			}
		}
		return null
	}
	private restartStream() {
		this.grid.setColumns(this.userEntries.length)
		this.streamMessenger=undefined
		this.restartStreamCallback()
		this.startStreamIfNotStartedAndGotAllUids()
	}
	private startStreamIfNotStartedAndGotAllUids() {
		if (this.streamMessenger) return
		const uidToColumns=new Map<number,number[]>
		for (const [i,entry] of this.userEntries.entries()) {
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
		const $tab=makeDiv('tab')()
		if (query.type=='id') {
			$tab.append(`#${query.uid}`)
		} else {
			$tab.append(query.username)
		}
		const $closeButton=makeElement('button')('close')('X')
		$closeButton.title=`Remove user`
		$closeButton.innerHTML=`<svg width=16 height=16><use href="#close" /></svg>`
		$closeButton.addEventListener('click',this.wrappedRemoveUserClickListener)
		$tab.append(` `,$closeButton)
		$tab.style.gridRow='1'
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
		$card.style.gridRow='2'
		return $card
	}
	private removeUserClickListener($button: HTMLElement): void {
		const $tab=$button.closest('.tab')
		for (const [i,entry] of this.userEntries.entries()) {
			if (entry.$tab!=$tab) continue
			this.userEntries.splice(i,1)
			this.sendUpdatedUserQueries()
			entry.$tab.remove()
			entry.$card.remove()
			this.grid.setColumns(this.userEntries.length)
			this.restartStream()
			break
		}
	}
	private sendUpdatedUserQueries(): void {
		this.sendUpdatedUserQueriesReceiver(this.userEntries.map(({query})=>query))
	}
	private sendUserQueryToWorker(query: ValidUserQuery) {
		this.worker.port.postMessage({
			type: 'getUserInfo',
			host: this.cx.server.host,
			query
		})
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
