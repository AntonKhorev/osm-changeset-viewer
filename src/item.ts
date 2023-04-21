import type {WebProvider} from './net'
import {makeDateOutput} from './date'
import type {ChangesetDbRecord, NoteDbRecord} from './db'
import {makeElement, makeDiv, makeLink} from './util/html'
import {code} from './util/html-shortcuts'
import {makeEscapeTag} from './util/escape'

const e=makeEscapeTag(encodeURIComponent)

export function getItemCheckbox($item: HTMLElement): HTMLInputElement|undefined {
	const $checkbox=$item.querySelector('.icon input')
	if ($checkbox instanceof HTMLInputElement) {
		return $checkbox
	}
}

export function markChangesetCardAsCombined($item: HTMLElement, id: number|string): void {
	$item.classList.add('combined')
	const $checkbox=getItemCheckbox($item)
	if ($checkbox) $checkbox.title=`changeset ${id}`
}

export function markChangesetCardAsUncombined($item: HTMLElement, id: number|string): void {
	$item.classList.remove('combined')
	const $checkbox=getItemCheckbox($item)
	if ($checkbox) $checkbox.title=`opened changeset ${id}`
}

export function makeChangesetCard(web: WebProvider, changeset: ChangesetDbRecord, isClosed: boolean): HTMLElement {
	const makeDate=()=>{
		const date=isClosed ? changeset.closedAt : changeset.createdAt
		return date ? makeDateOutput(date) : `???`
	}
	let $item: HTMLElement
	if (isClosed) {
		const $noCheckbox=makeElement('span')('no-checkbox')()
		$noCheckbox.tabIndex=0
		$noCheckbox.title=`closed changeset ${changeset.id}`
		$item=makeItemCard('changeset',$noCheckbox)
	} else {
		const $checkbox=makeElement('input')()()
		$checkbox.type='checkbox'
		$checkbox.title=`opened changeset ${changeset.id}`
		$item=makeItemCard('changeset',$checkbox)
	}
	$item.append(
		makeLink(`${changeset.id}`,web.getUrl(e`changeset/${changeset.id}`)),` `,
		makeDate(),` `,
		changeset.tags?.comment ?? ''
	)
	if (isClosed) $item.classList.add('closed')
	return $item
}

export function makeNoteCard(web: WebProvider, note: NoteDbRecord): HTMLElement {
	const $item=makeItemCard('note',code(`N!`))
	$item.append(
		makeLink(`${note.id}`,web.getUrl(e`note/${note.id}`)),` `,
		makeDateOutput(note.createdAt),` `,
		note.openingComment ?? ''
	)
	return $item
}

function makeItemCard(type: string, $iconChild: HTMLElement): HTMLElement {
	const $icon=makeElement('span')('icon')($iconChild)
	const $item=makeDiv('item',type)($icon,` `)
	return $item
}
