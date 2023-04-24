import type {UserQuery, ValidUserQuery} from './osm/query-user'
import type {UserDbRecord} from './db'
import {makeDateOutput} from './date'
import {makeElement, makeDiv, makeLabel, makeLink} from './util/html'

export type UserInfo = {
	status: 'pending'|'running'|'failed'
} | {
	status: 'ready'
	user: UserDbRecord
}

export function makeUserTab(
	removeColumnClickListener: (this:HTMLElement)=>void,
	query: ValidUserQuery
): HTMLElement {
	const $label=makeElement('span')('label')()
	if (query.type=='id') {
		$label.append(`#${query.uid}`)
	} else {
		$label.append(query.username)
	}
	const $closeButton=makeCloseButton(removeColumnClickListener)
	$closeButton.title=`Remove user`
	return makeDiv('tab')($label,` `,$closeButton)
}

export function makeFormTab(
	removeColumnClickListener: (this:HTMLElement)=>void
): HTMLElement {
	const $label=makeElement('span')('label')(`Add user`)
	const $closeButton=makeCloseButton(removeColumnClickListener)
	$closeButton.title=`Remove form`
	return makeDiv('tab')($label,` `,$closeButton)
}

function makeCloseButton(
	removeColumnClickListener: (this:HTMLElement)=>void
): HTMLButtonElement {
	const $closeButton=makeElement('button')('close')()
	$closeButton.innerHTML=`<svg width=16 height=16><use href="#close" /></svg>`
	$closeButton.addEventListener('click',removeColumnClickListener)
	return $closeButton
}

export function makeUserCard(
	query: ValidUserQuery, info: UserInfo, $downloadedChangesetsCount: HTMLOutputElement,
	getUserNameHref: (name:string)=>string,
	getUserIdHref: (id:number)=>string,
	processValidUserQuery: (query:ValidUserQuery)=>void
): HTMLElement {
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
					? makeLink(info.user.name,getUserNameHref(info.user.name))
					: `deleted user`
				),` `,
				makeElement('span')('uid')(
					`(`,makeLink(`#${info.user.id}`,getUserIdHref(info.user.id)),`)`
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
			processValidUserQuery(query)
		}
	}
	return $card
}

export function makeFormCard(
	getUserQueryFromInputValue: (value:string)=>UserQuery,
	processValidUserQuery: (query:ValidUserQuery)=>void
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
		processValidUserQuery(query)
	}
	$card.append($form)
	return $card
}

export function makeUserSelector(): HTMLElement {
	const $checkbox=makeElement('input')()()
	$checkbox.type='checkbox'
	const $icon=makeElement('span')('icon')($checkbox)
	return makeDiv('selector')($icon)
}

export function makeFormSelector(): HTMLElement {
	return makeDiv('selector')()
}
