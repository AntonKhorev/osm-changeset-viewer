import type Grid from './grid'
import type {Connection} from './net'
import type {ValidUserQuery} from './osm'
import {toUserQuery} from './osm'
import ChangesetStream from './changeset-stream'
import MuxChangesetStream from './mux-changeset-stream'
import {makeElement, makeDiv, makeLabel} from './util/html'

type GridUserEntry = {
	query: ValidUserQuery
	$user: HTMLElement
}

export default class GridHead {
	private userEntries=[] as GridUserEntry[]
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
		this.grid.$grid.append(this.$form)
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
		this.$form.onsubmit=ev=>{
			ev.preventDefault()
			const query=toUserQuery(cx.server.api,cx.server.web,$userInput.value)
			if (query.type=='invalid' || query.type=='empty') return
			const $user=this.makeUserCard(query)
			this.userEntries.push({query,$user})
			this.sendUpdatedUserQueries()
			this.$form.before($user)
			this.grid.setColumns(this.userEntries.length)
			this.openAndSendStream()
		}
	}
	receiveUpdatedUserQueries(userQueries: ValidUserQuery[]): void {
		{
			const newUserEntries=[] as GridUserEntry[]
			for (const [i,query] of userQueries.entries()) {
				let entry=this.pickFromExistingUserEntries(query)
				if (!entry) {
					const $user=this.makeUserCard(query)
					entry={query,$user}
				}
				newUserEntries.push(entry)
			}
			for (const {$user} of this.userEntries) {
				$user.remove()
			}
			this.userEntries=newUserEntries
		}
		this.grid.$grid.prepend(...this.userEntries.map(({$user})=>$user))
		this.grid.setColumns(this.userEntries.length)
		this.openAndSendStream()
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
		this.sendStreamReceiver(
			new MuxChangesetStream(
				this.userEntries.map(({query})=>new ChangesetStream(this.cx,query))
			)
		)
	}
	private makeUserCard(query: ValidUserQuery): HTMLElement {
		const $tab=makeDiv('tab')()
		if (query.type=='id') {
			$tab.append(`#${query.uid}`)
		} else {
			$tab.append(query.username)
		}
		const $closeButton=makeElement('button')()('X')
		$closeButton.title=`Remove user`
		$closeButton.addEventListener('click',this.wrappedRemoveUserClickListener)
		$tab.append($closeButton)
		return makeDiv('user')($tab)
	}
	private removeUserClickListener($button: HTMLElement): void {
		const $user=$button.closest('.user')
		for (const [i,entry] of this.userEntries.entries()) {
			if (entry.$user!=$user) continue
			this.userEntries.splice(i,1)
			this.sendUpdatedUserQueries()
			$user.remove()
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
