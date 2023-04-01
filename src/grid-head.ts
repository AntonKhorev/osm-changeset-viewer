import type {Connection} from './net'
import type {ValidUserQuery} from './osm'
import {toUserQuery} from './osm'
import ChangesetStream from './changeset-stream'
import {makeElement, makeDiv, makeLabel} from './util/html'

export default class GridHead {
	// private userQueries: ValidUserQuery[] = []
	constructor(
		cx: Connection,
		$grid: HTMLElement,
		receiveStream: (stream: ChangesetStream)=>void
	) {
		const $userInput=makeElement('input')()()
		$userInput.type='text'
		$userInput.name='user'
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
		$grid.append($form)
		$userInput.oninput=()=>{
			const userQuery=toUserQuery(cx.server.api,cx.server.web,$userInput.value)
			if (userQuery.type=='invalid') {
				$userInput.setCustomValidity(userQuery.message)
			} else if (userQuery.type=='empty') {
				$userInput.setCustomValidity(`user query cannot be empty`)
			} else {
				$userInput.setCustomValidity('')
			}
		}
		$form.onsubmit=ev=>{
			ev.preventDefault()
			const userQuery=toUserQuery(cx.server.api,cx.server.web,$userInput.value)
			if (userQuery.type=='invalid' || userQuery.type=='empty') return
			const stream=new ChangesetStream(cx,userQuery)
			receiveStream(stream)
		}
	}
}
