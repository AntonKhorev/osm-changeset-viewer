import type {UserQuery, ValidUserQuery} from './osm/query-user'
import type {UserScanDbRecord, UserDbInfo} from './db'
import {makeDateOutput} from './date'
import {makeElement, makeDiv, makeLabel, makeLink} from './util/html'
import {ul,li} from './util/html-shortcuts'

export type CompleteUserInfo = {
	status: 'rerunning'|'ready'
} & UserDbInfo
export type UserInfo = {
	status: 'pending'|'failed'|'running'
} | CompleteUserInfo

export function makeUserTab(
	removeColumnClickListener: (this:HTMLElement)=>void,
	query: ValidUserQuery
): HTMLElement {
	const $icon=makeElement('span')('icon')()
	$icon.title=`user`
	$icon.innerHTML=`<svg width="16" height="16"><use href="#user" /></svg>`
	const $label=makeElement('span')('label')()
	if (query.type=='id') {
		$label.append(`#${query.uid}`)
	} else {
		$label.append(query.username)
	}
	const $closeButton=makeCloseButton(removeColumnClickListener)
	$closeButton.title=`Remove user`
	return makeDiv('tab')($icon,` `,$label,` `,$closeButton)
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
	$closeButton.innerHTML=`<svg width="16" height="16"><use href="#close" /></svg>`
	$closeButton.addEventListener('click',removeColumnClickListener)
	return $closeButton
}

export function makeUserCard(
	query: ValidUserQuery, info: UserInfo, $downloadedChangesetsCount: HTMLOutputElement,
	getUserNameHref: (name:string)=>string,
	getUserIdHref: (id:number)=>string,
	processValidUserQuery: (query:ValidUserQuery)=>void,
	rescan: (type: UserScanDbRecord['type'])=>void
): HTMLElement {
	const $card=makeDiv('card')()
	if (info.status=='pending' || info.status=='running') {
		$card.append(makeDiv('notice')(`waiting for user data`))
	} else if (info.status=='rerunning' || info.status=='ready') {
		const $totalChangesetsCount=makeElement('output')()()
		const $updateButton=makeElement('button')()(`update`)
		$updateButton.disabled=info.status=='rerunning'
		if (info.user.visible) {
			$totalChangesetsCount.textContent=String(info.user.changesets.count)
			$totalChangesetsCount.title=`opened by the user`
		} else {
			$totalChangesetsCount.textContent=`???`
			$totalChangesetsCount.title=`number of changesets opened by the user is unknown because the user is deleted`
		}
		if (info.scans.changesets) {
			$downloadedChangesetsCount.textContent=String(info.scans.changesets.items.count)
		} else {
			$downloadedChangesetsCount.textContent=`0`
		}
		if (info.user.visible && info.user.img) {
			const $img=makeElement('img')()()
			$img.src=info.user.img.href
			$card.append(
				makeDiv('avatar')($img)
			)
		}
		$card.append(
			makeDiv('field')(
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
				makeDiv('field')(
					`account created at `,makeDateOutput(info.user.createdAt)
				)
			)
		} else {
			const $unknown=makeElement('span')()(`???`)
			$unknown.title=`date is unknown because the user is deleted`
			$card.append(
				makeDiv('field')(
					`created at `,$unknown
				)
			)
		}
		$card.append(
			makeDiv('field')(
				`changesets: `,$downloadedChangesetsCount,` / `,$totalChangesetsCount
			)
		)
		$card.append(
			makeDiv('field','updates')(
				`info updated at:`,
				ul(
					li(`user: `,makeDateOutput(info.user.infoUpdatedAt),` `,$updateButton),
					makeScanListItem('changesets',info.scans.changesets,rescan),
					makeScanListItem('notes',info.scans.notes,rescan)
				)
			)
		)
		$updateButton.onclick=()=>{
			processValidUserQuery(query)
		}
	} else {
		$card.append(makeDiv('notice')(`unable to get user data`))
	}
	return $card
}

function makeScanListItem(
	type: UserScanDbRecord['type'], scan: UserScanDbRecord|undefined,
	rescan: (type: UserScanDbRecord['type'])=>void
): HTMLElement {
	const $field=li(`${type}: `)
	if (scan) {
		$field.append(
			makeDateOutput(scan.beginDate)
		)
		if (scan.endDate) {
			$field.append(`..`,makeDateOutput(scan.endDate))
		} else {
			const $incomplete=makeElement('span')()(`...`)
			$incomplete.title=`incomplete`
			$field.append($incomplete)
		}
		const $rescanButton=makeElement('button')()(`rescan`)
		$field.append(` `,$rescanButton)
		$rescanButton.onclick=()=>{
			rescan(type)
		}
	} else {
		$field.append(`not started`)
	}
	return $field
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
