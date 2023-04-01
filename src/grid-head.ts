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
	constructor(
		private cx: Connection,
		private $grid: HTMLElement,
		sendUpdatedUserQueries: (userQueries: ValidUserQuery[])=>void,
		private sendStream: (muxStream: MuxChangesetStream)=>void
	) {
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
		$grid.append(this.$form)
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
			const $user=makeUserCard(query)
			$user.style.gridColumn=String(this.userEntries.length+1)
			this.userEntries.push({query,$user})
			sendUpdatedUserQueries(this.userEntries.map(({query})=>query))
			this.$form.style.gridColumn=String(this.userEntries.length+1)
			this.$form.before($user)
			this.openAndSendStream()
		}
	}
	receiveUpdatedUserQueries(userQueries: ValidUserQuery[]): void {
		const newUserEntries=[] as GridUserEntry[]
		for (const [i,query] of userQueries.entries()) {
			let entry=this.pickFromExistingUserEntries(query)
			if (!entry) {
				const $user=makeUserCard(query)
				entry={query,$user}
			}
			entry.$user.style.gridColumn=String(i+1)
			newUserEntries.push(entry)
		}
		this.$form.style.gridColumn=String(newUserEntries.length+1)
		for (const {$user} of this.userEntries) {
			$user.remove()
		}
		this.userEntries=newUserEntries
		this.$grid.prepend(...newUserEntries.map(({$user})=>$user))
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
		this.sendStream(
			new MuxChangesetStream(
				this.userEntries.map(({query})=>new ChangesetStream(this.cx,query))
			)
		)
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

function makeUserCard(query: ValidUserQuery): HTMLElement {
	const $user=makeDiv('user')()
	if (query.type=='id') {
		$user.append(`#${query.uid}`)
	} else {
		$user.append(query.username)
	}
	return $user
}
