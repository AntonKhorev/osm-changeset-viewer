import type {UserQuery, ValidUserQuery} from './osm/query-user'
import {makeElement, makeDiv, makeLabel} from './util/html'

export function makeFormCard(
	getUserQueryFromInputValue: (value:string)=>UserQuery,
	processValidUserQuery: (query:ValidUserQuery)=>Promise<void>
) {
	const $card=makeDiv('card')()
	const $userInput=makeElement('input')()()
	$userInput.type='text'
	$userInput.name='user'
	$userInput.oninput=()=>{
		const query=getUserQueryFromInputValue($userInput.value)
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
		const query=getUserQueryFromInputValue($userInput.value)
		if (query.type=='invalid' || query.type=='empty') return
		await processValidUserQuery(query)
	}
	$card.append($form)
	return $card
}
