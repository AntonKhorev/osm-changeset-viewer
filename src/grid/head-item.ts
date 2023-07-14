import type {UserQuery, ValidUserQuery} from '../osm/query-user'
import type {UserScanDbRecord, UserDbInfo} from '../db'
import type Colorizer from '../colorizer'
import {makeUserSvgElements} from './body-item'
import {makeCenteredSvg} from '../widgets'
import {makeDateOutput} from '../date'
import {makeElement, makeDiv, makeLabel, makeLink} from '../util/html'
import {ul} from '../util/html-shortcuts'

export type CompleteUserInfo = {
	status: 'rerunning'|'ready'
} & UserDbInfo
export type UserInfo = {
	status: 'pending'|'failed'|'running'
} | CompleteUserInfo

export function makeAllTab(): HTMLElement {
	const $icon=makeElement('span')('icon')()
	$icon.title=`all user items`
	$icon.innerHTML=makeCenteredSvg(8,
		`<line y1="-6" y2="6" stroke="currentColor" stroke-width="2" />`+
		`<line y1="-6" y2="6" stroke="currentColor" stroke-width="2" transform="rotate(60)" />`+
		`<line y1="-6" y2="6" stroke="currentColor" stroke-width="2" transform="rotate(-60)" />`
	)
	return makeDiv('tab')($icon)
}

export function makeUserTab(
	removeColumnClickListener: (this:HTMLElement)=>void,
	query: ValidUserQuery
): HTMLElement {
	const $icon=makeElement('span')('icon')()
	$icon.title=`user`
	$icon.innerHTML=makeCenteredSvg(8,makeUserSvgElements())
	const $label=makeElement('span')('column-label')()
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
	const $label=makeElement('span')('column-label')(`Add user`)
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
	$displayedChangesetsCount: HTMLOutputElement,
	$displayedNotesCount: HTMLOutputElement,
	update: ()=>void,
	rescan: (type: UserScanDbRecord['type'], uid: number)=>void
): HTMLElement {
	const hide=($e:HTMLElement)=>{
		$e.hidden=true
		return $e
	}
	const makeCountsField=(className: string, title: string, $displayedCount: HTMLOutputElement)=>{
		// $displayedCount.classList.add('displayed')
		const $downloadedCount=makeElement('output')('downloaded')()
		const $totalCount=makeElement('output')('total')()
		return makeDiv('field',className)(
			`${title}: `,$displayedCount,` / `,$downloadedCount,` / `,$totalCount
		)
	}
	const at=()=>makeElement('output')('at')()
	const makeUpdateButton=(title:string,callback:()=>void)=>{
		const $button=makeElement('button')('with-icon')()
		$button.title=title
		$button.innerHTML=`<svg width="16" height="16"><use href="#repeat" /></svg>`
		$button.onclick=()=>{
			callback()
			rotateButton($button)
		}
		return $button
	}
	const makeUpdatesLi=(type:UserScanDbRecord['type'])=>makeElement('li')(type)(
		`${type}: `,at(),` `,makeUpdateButton(
			`rescan`,()=>{
				const uid=$card.dataset.uid
				if (uid!=null) {
					rescan(type,Number(uid))
				}
			}
		)
	)
	const makeHuePicker=()=>{
		const $stripe=makeElement('span')('hue-picker-stripe')()
		const stripeStops:string[]=[]
		for (let hue=0;hue<=720;hue+=30) {
			stripeStops.push(`hsl(${hue-180} 100% 50%) ${100*hue/720}%`)
		}
		$stripe.style.background=`linear-gradient(to right, ${stripeStops.join(', ')})`
		const $picker=makeDiv('hue-picker')($stripe)
		$picker.tabIndex=0
		return $picker
	}
	const $card=makeDiv('card')(
		hide(makeDiv('notice')()),
		hide(makeDiv('avatar')()),
		hide(makeDiv('field','name')()),
		hide(makeDiv('field','created-at')(
			`account created at `,at()
		)),
		hide(makeCountsField('changesets',`changesets`,$displayedChangesetsCount)),
		hide(makeCountsField('notes',`notes`,$displayedNotesCount)),
		hide(makeDiv('field','updates')(
			`info updated at:`,
			ul(
				makeElement('li')('name')(`username: `,at()),
				makeElement('li')('details')(`user details: `,at(),` `,makeUpdateButton(
					`update`,update
				)),
				makeUpdatesLi('changesets'),
				makeUpdatesLi('notes')
			)
		)),
		hide(makeHuePicker())
	)
	return $card
}

export function updateUserCard(
	colorizer: Colorizer,
	$card: HTMLElement, info: UserInfo,
	getUserNameHref: (name:string)=>string,
	getUserIdHref: (id:number)=>string
): void {
	if (info.status=='rerunning' || info.status=='ready') {
		$card.dataset.uid=String(info.user.id)
	} else {
		delete $card.dataset.uid
	}
	const $notice=$card.querySelector(':scope > .notice')
	const $avatar=$card.querySelector(':scope > .avatar')
	const $nameField=$card.querySelector(':scope > .field.name')
	const $createdAtField=$card.querySelector(':scope > .field.created-at')
	const $changesetsField=$card.querySelector(':scope > .field.changesets')
	const $notesField=$card.querySelector(':scope > .field.notes')
	const $updatesField=$card.querySelector(':scope > .field.updates')
	const $huePicker=$card.querySelector(':scope > .hue-picker')
	if ($notice instanceof HTMLElement) {
		if (info.status=='pending' || info.status=='running') {
			$notice.hidden=false
			$notice.textContent=`waiting for user data`
		} else if (info.status=='failed') {
			$notice.hidden=false
			$notice.textContent=`unable to get user data`
		} else {
			$notice.hidden=true
			$notice.textContent=``
		}
	}
	if ($avatar instanceof HTMLElement) {
		if (
			(info.status=='rerunning' || info.status=='ready') &&
			info.user.withDetails && info.user.visible && info.user.img
		) {
			$avatar.hidden=false
			const $img=makeElement('img')()()
			$img.src=info.user.img.href
			$avatar.replaceChildren($img)
		} else {
			$avatar.hidden=true
			$avatar.replaceChildren()
		}
	}
	if ($nameField instanceof HTMLElement) {
		if (
			info.status=='rerunning' || info.status=='ready'
		) {
			$nameField.hidden=false
			const notKnownToBeDelelted = !info.user.withDetails || info.user.visible
			let namePlaceholder: string|HTMLAnchorElement
			if (info.user.name) {
				if (notKnownToBeDelelted) {
					namePlaceholder=makeLink(info.user.name,getUserNameHref(info.user.name))
				} else {
					namePlaceholder=info.user.name
				}
			} else {
				if (notKnownToBeDelelted) {
					namePlaceholder=`user without requested details`
				} else {
					namePlaceholder=`deleted user`
				}
			}
			$nameField.replaceChildren(
				namePlaceholder,` `,
				makeElement('span')('api')(
					`(`,makeLink(`#${info.user.id}`,getUserIdHref(info.user.id)),`)`
				)
			)
		} else {
			$nameField.hidden=true
			$nameField.replaceChildren()
		}
	}
	if ($createdAtField instanceof HTMLElement) {
		if (
			(info.status=='rerunning' || info.status=='ready') &&
			info.user.withDetails
		) {
			$createdAtField.hidden=false
			const $at=$createdAtField.querySelector(':scope > output.at')
			if ($at instanceof HTMLElement) {
				if (info.user.visible) {
					$at.replaceChildren(
						makeDateOutput(info.user.createdAt)
					)
				} else {
					const $unknown=makeElement('span')()(`???`)
					$unknown.title=`date is unknown because the user is deleted`
					$at.replaceChildren(
						$unknown
					)
				}
			}
		} else {
			$createdAtField.hidden=true
		}
	}
	if ($changesetsField instanceof HTMLElement) {
		if (
			info.status=='rerunning' || info.status=='ready'
		) {
			$changesetsField.hidden=false
			const $downloadedCount=$changesetsField.querySelector(':scope > output.downloaded')
			if ($downloadedCount instanceof HTMLElement) {
				$downloadedCount.textContent=(info.scans.changesets
					? String(info.scans.changesets.items.count)
					: `0`
				)
				$downloadedCount.title=`downloaded`
			}
			const $totalCount=$changesetsField.querySelector(':scope > output.total')
			if ($totalCount instanceof HTMLElement) {
				if (info.user.withDetails && info.user.visible) {
					$totalCount.textContent=String(info.user.changesets.count)
					$totalCount.title=`opened by the user`
				} else {
					$totalCount.textContent=`???`
					$totalCount.title=`number of changesets opened by the user is unknown because `+(info.user.withDetails
						? `user details weren't requested`
						: `the user is deleted`
					)
				}
			}
		} else {
			$changesetsField.hidden=true
		}
	}
	if ($notesField instanceof HTMLElement) {
		if (
			info.status=='rerunning' || info.status=='ready'
		) {
			$notesField.hidden=false
			const $downloadedCount=$notesField.querySelector(':scope > output.downloaded')
			if ($downloadedCount instanceof HTMLElement) {
				$downloadedCount.textContent=(info.scans.notes
					? String(info.scans.notes.items.count)
					: `0`
				)
				$downloadedCount.title=`downloaded`
			}
			const $totalCount=$notesField.querySelector(':scope > output.total')
			if ($totalCount instanceof HTMLElement) {
				$totalCount.textContent=`???`
				$totalCount.title=`number of notes created by the user is unknown because the API doesn't report it`
			}
		} else {
			$notesField.hidden=true
		}
	}
	if ($updatesField instanceof HTMLElement) {
		if (
			info.status=='rerunning' || info.status=='ready'
		) {
			$updatesField.hidden=false
			const $nameAt=$updatesField.querySelector(':scope > ul > li.name > output.at')
			if ($nameAt instanceof HTMLElement) {
				$nameAt.replaceChildren(
					makeDateOutput(info.user.nameUpdatedAt)
				)
			}
			const $updateDetailsButton=$updatesField.querySelector(':scope > ul > li.details > button')
			if ($updateDetailsButton instanceof HTMLButtonElement) {
				$updateDetailsButton.disabled=info.status=='rerunning'
			}
			const $detailsAt=$updatesField.querySelector(':scope > ul > li.details > output.at')
			if ($detailsAt instanceof HTMLElement) {
				$detailsAt.replaceChildren(info.user.withDetails
					? makeDateOutput(info.user.detailsUpdatedAt)
					: `not requested`
				)
			}
			const updateScan=($at:HTMLElement,scan:UserScanDbRecord|undefined)=>{
				$at.replaceChildren()
				if (!scan) {
					$at.append(`not started`)
					return
				}
				$at.append(makeDateOutput(scan.beginDate))
				if (scan.endDate) {
					$at.append(`..`,makeDateOutput(scan.endDate))
				} else {
					const $incomplete=makeElement('span')()(`...`)
					$incomplete.title=`incomplete`
					$at.append($incomplete)
				}
			}
			const $changesetsAt=$updatesField.querySelector(':scope > ul > li.changesets > output.at')
			if ($changesetsAt instanceof HTMLElement) {
				updateScan($changesetsAt,info.scans.changesets)
			}
			const $notesAt=$updatesField.querySelector(':scope > ul > li.notes > output.at')
			if ($notesAt instanceof HTMLElement) {
				updateScan($notesAt,info.scans.notes)
			}
		} else {
			$updatesField.hidden=true
		}
	}
	if ($huePicker instanceof HTMLElement) {
		if (info.status=='rerunning' || info.status=='ready') {
			$huePicker.hidden=false
			const hue=colorizer.getHueForUid(info.user.id)
			const $stripe=$huePicker.querySelector(':scope > .hue-picker-stripe')
			if ($stripe instanceof HTMLElement) {
				$stripe.style.left=`${-hue*100/360}%`
			}
		} else {
			$huePicker.hidden=true
		}
	}
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
	return makeDiv('selector')(
		$icon,` `,makeElement('output')('column-label')()
	)
}

export function makeFormSelector(): HTMLElement {
	return makeDiv('selector')()
}

function rotateButton($button: HTMLElement): void {
	requestAnimationFrame(()=>{
		$button.style.removeProperty('transition')
		$button.style.removeProperty('rotate')
		requestAnimationFrame(()=>{
			$button.style.transition=`rotate 200ms`
			$button.style.rotate=`1turn`
		})
	})
}
