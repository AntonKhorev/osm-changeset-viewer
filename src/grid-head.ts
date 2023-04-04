import type Grid from './grid'
import type {Connection} from './net'
import {ValidUserQuery, OsmUserApiData, OsmChangesetApiData, getUserFromOsmApiResponse} from './osm'
import {toUserQuery} from './osm'
import ChangesetStream from './changeset-stream'
import MuxChangesetStream from './mux-changeset-stream'
import {makeElement, makeDiv, makeLabel, makeLink} from './util/html'
import {makeEscapeTag} from './util/escape'

const e=makeEscapeTag(encodeURIComponent)

type UserData = {
	user: OsmUserApiData
	changesets: OsmChangesetApiData[]
	scanStartDate?: Date
	scanEndDate?: Date
	stream?: ChangesetStream
}

class CachedChangesetStream {
	position=0
	constructor(
		private readonly cx: Connection,
		private readonly userData: UserData
	) {}
	async fetch(): Promise<OsmChangesetApiData[]> {
		const limit=100
		if (this.position<this.userData.changesets.length-limit) {
			const i1=this.position
			this.position+=limit
			const i2=this.position
			return this.userData.changesets.slice(i1,i2)
		} else if (this.position<this.userData.changesets.length) {
			const i1=this.position
			this.position=this.userData.changesets.length
			return this.userData.changesets.slice(i1)
		} else if (this.userData.scanEndDate) {
			return []
		}
		if (!this.userData.scanStartDate && this.userData.changesets.length==0) {
			this.userData.scanStartDate=new Date()
		}
		if (!this.userData.stream) {
			const query={type:'id',uid:this.userData.user.id} as ValidUserQuery
			this.userData.stream=new ChangesetStream(this.cx,query,this.userData.changesets)
		}
		const batch=await this.userData.stream.fetch()
		this.userData.changesets.push(...batch)
		this.position=this.userData.changesets.length
		if (batch.length==0) {
			this.userData.scanEndDate=new Date()
		}
		return batch
	}
}

const userNameToId=new Map<string,number>() // 0 = unknown uid because has no changesets
const userIdToData=new Map<number,UserData>()

type GridUserEntry = {
	query: ValidUserQuery
	$tab: HTMLElement
	$card: HTMLElement
}

export default class GridHead {
	private userEntries=[] as GridUserEntry[]
	private $filler=makeDiv()() // cell filler above add user form
	private $form=makeElement('form')()()
	private wrappedRemoveUserClickListener: (this:HTMLElement)=>void
	constructor(
		private cx: Connection,
		private grid: Grid,
		private sendUpdatedUserQueriesReceiver: (userQueries: ValidUserQuery[])=>void,
		private sendStreamReceiver: (muxStream: MuxChangesetStream|null)=>void
	) {
		{
			const that=this
			this.wrappedRemoveUserClickListener=function(){
				that.removeUserClickListener(this)
			}
		}
		this.$filler.style.gridRow='1'
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
		this.grid.$grid.append(this.$filler,this.$form)
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
			const userData=await this.getUserDataForQuery(query)
			const $tab=this.makeUserTab(query)
			const $card=this.makeUserCard(userData)
			this.userEntries.push({query,$tab,$card})
			this.sendUpdatedUserQueries()
			this.$filler.before($tab)
			this.$form.before($card)
			this.grid.setColumns(this.userEntries.length)
			this.openAndSendStream()
		}
	}
	async receiveUpdatedUserQueries(userQueries: ValidUserQuery[]): Promise<void> {
		{
			const newUserEntries=[] as GridUserEntry[]
			for (const query of userQueries) {
				let entry=this.pickFromExistingUserEntries(query)
				if (!entry) {
					const userData=await this.getUserDataForQuery(query)
					const $tab=this.makeUserTab(query)
					const $card=this.makeUserCard(userData)
					entry={query,$tab,$card}
				}
				newUserEntries.push(entry)
			}
			for (const {$tab,$card} of this.userEntries) {
				$tab.remove()
				$card.remove()
			}
			this.userEntries=newUserEntries
		}
		this.$filler.before(...this.userEntries.map(({$tab})=>$tab))
		this.$form.before(...this.userEntries.map(({$card})=>$card))
		this.grid.setColumns(this.userEntries.length)
		this.openAndSendStream()
	}
	private async getUserDataForQuery(query: ValidUserQuery): Promise<UserData|null> {
		const scanStartDate=new Date()
		let stream: ChangesetStream|undefined
		let changesets=[] as OsmChangesetApiData[]
		let uid: number|undefined
		if (query.type=='name') {
			uid=userNameToId.get(query.username)
			if (uid==null) {
				stream=new ChangesetStream(this.cx,query)
				changesets=await stream.fetch()
				if (changesets.length==0) {
					uid=0
					userNameToId.set(query.username,uid)
					return null
				}
				uid=changesets[0].uid
				userNameToId.set(query.username,uid)
			}
		} else {
			uid=query.uid
		}
		let userData=userIdToData.get(uid)
		if (userData) return userData
		const result=await this.cx.server.api.fetch(e`user/${uid}.json`)
		const json=await result.json()
		const user=getUserFromOsmApiResponse(json)
		userData={
			user,
			changesets
		}
		if (stream) {
			userData={
				...userData,
				stream,
				scanStartDate
			}
		}
		userIdToData.set(uid,userData)
		return userData
		
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
	private openAndSendStream(): void {
		if (this.userEntries.length==0) {
			this.sendStreamReceiver(null)
			return
		}
		const emptyStream={
			fetch: async()=>[]
		}
		this.sendStreamReceiver(
			new MuxChangesetStream(
				// this.userEntries.map(({query})=>new ChangesetStream(this.cx,query))
				this.userEntries.map(({query})=>{
					let uid=0
					if (query.type=='id') {
						uid=query.uid
					} else {
						uid=userNameToId.get(query.username)??0
					}
					if (uid==0) {
						return emptyStream
					}
					const userData=userIdToData.get(uid)
					if (!userData) return emptyStream // shouldn't happen
					return new CachedChangesetStream(this.cx,userData) // TODO multiple columns with same query
				})
			)
		)
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
	private makeUserCard(userData: UserData|null): HTMLElement {
		const $card=makeDiv('card')()
		if (!userData) {
			$card.append(makeDiv('notice')(`unable to get user data`))
		} else {
			$card.append(
				makeDiv('name')(
					makeLink(userData.user.display_name,this.cx.server.web.getUrl(e`user/${userData.user.display_name}`)),` `,
					`(`,makeLink(`#${userData.user.id}`,this.cx.server.api.getUrl(e`user/${userData.user.id}.json`)),`)`
				)
			)
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
			this.openAndSendStream()
		}
	}
	private sendUpdatedUserQueries(): void {
		this.sendUpdatedUserQueriesReceiver(this.userEntries.map(({query})=>query))
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
