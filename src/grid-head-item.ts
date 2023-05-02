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
	const $closeButton=makeElement('button')('with-icon')()
	$closeButton.innerHTML=`<svg width="16" height="16"><use href="#close" /></svg>`
	$closeButton.addEventListener('click',removeColumnClickListener)
	return $closeButton
}

export function makeUserCard(
	query: ValidUserQuery, info: UserInfo,
	$displayedChangesetsCount: HTMLOutputElement,
	$displayedNotesCount: HTMLOutputElement,
	getUserNameHref: (name:string)=>string,
	getUserIdHref: (id:number)=>string,
	processValidUserQuery: (query:ValidUserQuery)=>void,
	rescan: (type: UserScanDbRecord['type'], uid: number)=>void
): HTMLElement {
	const $card=makeDiv('card')()
	if (info.status=='pending' || info.status=='running') {
		$card.append(makeDiv('notice')(`waiting for user data`))
	} else if (info.status=='rerunning' || info.status=='ready') {
		const $updateButton=makeElement('button')('with-icon')()
		$updateButton.title=`update`
		$updateButton.innerHTML=`<svg width="16" height="16"><use href="#repeat" /></svg>`
		$updateButton.disabled=info.status=='rerunning'
		if (info.user.withDetails && info.user.visible && info.user.img) {
			const $img=makeElement('img')()()
			$img.src=info.user.img.href
			$card.append(
				makeDiv('avatar')($img)
			)
		}
		let notKnownToBeDelelted = !info.user.withDetails || info.user.visible
		let userNamePlaceholder: string|HTMLAnchorElement
		if (info.user.name) {
			if (notKnownToBeDelelted) {
				userNamePlaceholder=makeLink(info.user.name,getUserNameHref(info.user.name))
			} else {
				userNamePlaceholder=info.user.name
			}
		} else {
			if (notKnownToBeDelelted) {
				userNamePlaceholder=`user without requested details`
			} else {
				userNamePlaceholder=`deleted user`
			}
		}
		$card.append(
			makeDiv('field')(
				userNamePlaceholder,` `,
				makeElement('span')('api')(
					`(`,makeLink(`#${info.user.id}`,getUserIdHref(info.user.id)),`)`
				)
			)
		)
		if (info.user.withDetails) {
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
		}
		{
			const $downloadedChangesetsCount=makeElement('output')()()
			if (info.scans.changesets) {
				$downloadedChangesetsCount.textContent=String(info.scans.changesets.items.count)
			} else {
				$downloadedChangesetsCount.textContent=`0`
			}
			$downloadedChangesetsCount.title=`downloaded`
			const $totalChangesetsCount=makeElement('output')()()
			if (info.user.withDetails && info.user.visible) {
				$totalChangesetsCount.textContent=String(info.user.changesets.count)
				$totalChangesetsCount.title=`opened by the user`
			} else {
				$totalChangesetsCount.textContent=`???`
				$totalChangesetsCount.title=`number of changesets opened by the user is unknown because `+(info.user.withDetails
					? `user details weren't requested`
					: `the user is deleted`
				)
			}
			$card.append(
				makeDiv('field')(
					`changesets: `,$displayedChangesetsCount,` / `,$downloadedChangesetsCount,` / `,$totalChangesetsCount
				)
			)
		}{
			const $downloadedNotesCount=makeElement('output')()()
			if (info.scans.notes) {
				$downloadedNotesCount.textContent=String(info.scans.notes.items.count)
			} else {
				$downloadedNotesCount.textContent=`0`
			}
			$downloadedNotesCount.title=`downloaded`
			const $totalNotesCount=makeElement('output')()()
			$totalNotesCount.textContent=`???`
			$totalNotesCount.title=`number of notes created by the user is unknown because the API doesn't report it`
			$card.append(
				makeDiv('field')(
					`notes: `,$displayedNotesCount,` / `,$downloadedNotesCount,` / `,$totalNotesCount
				)
			)
		}
		$card.append(
			makeDiv('field','updates')(
				`info updated at:`,
				ul(
					li(`username: `,makeDateOutput(info.user.nameUpdatedAt)),
					li(`user details: `,(info.user.withDetails
						? makeDateOutput(info.user.detailsUpdatedAt)
						: `not requested`
					),` `,$updateButton),
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
	rescan: (type: UserScanDbRecord['type'], uid: number)=>void
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
		const $rescanButton=makeElement('button')('with-icon')()
		$rescanButton.title=`rescan`
		$rescanButton.innerHTML=`<svg width="16" height="16"><use href="#repeat" /></svg>`
		$field.append(` `,$rescanButton)
		$rescanButton.onclick=()=>{
			rescan(type,scan.uid)
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

export function makeUserSelector(
	selectAllItemsListener: ($checkbox:HTMLInputElement)=>void
): HTMLElement {
	const $checkbox=makeElement('input')()()
	$checkbox.type='checkbox'
	$checkbox.oninput=()=>selectAllItemsListener($checkbox)
	const $icon=makeElement('span')('icon')($checkbox)
	return makeDiv('selector')($icon)
}

export function makeFormSelector(): HTMLElement {
	return makeDiv('selector')()
}
