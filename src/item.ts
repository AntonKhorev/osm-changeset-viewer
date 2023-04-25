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
		const $icon=makeElement('span')('icon')($noCheckbox)
		$item=makeItemCard('changeset',$icon)
	} else {
		const $checkbox=makeElement('input')()()
		$checkbox.type='checkbox'
		$checkbox.title=`opened changeset ${changeset.id}`
		const $icon=makeElement('span')('icon')($checkbox)
		$item=makeItemCard('changeset',$icon)
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
	const $icon=makeElement('span')('icon')()
	$icon.innerHTML=makeNoteIconHtml()
	$icon.title=`note ${note.id}`
	const $item=makeItemCard('note',$icon)
	$item.append(
		makeLink(`${note.id}`,web.getUrl(e`note/${note.id}`)),` `,
		makeDateOutput(note.createdAt),` `,
		note.openingComment ?? ''
	)
	return $item
}

function makeItemCard(type: string, $icon: HTMLElement): HTMLElement {
	const $item=makeDiv('item',type)($icon,` `)
	return $item
}

function makeNoteIconHtml(): string {
	const iconSize=16
	const markerHeight=16
	const markerWidth=8
	const markerRadius=markerWidth/2
	const path=`<path d="${computeMarkerOutlinePath(markerHeight,markerRadius)}" fill="currentColor" />`
	return `<svg width="${iconSize}" height="${iconSize}" viewBox="${-iconSize/2} ${-markerRadius} ${iconSize} ${iconSize}">${path}</svg>`
	function computeMarkerOutlinePath(h: number, r: number): string {
		const rp=h-r
		const y=r**2/rp
		const x=Math.sqrt(r**2-y**2)
		const xf=x.toFixed(2)
		const yf=y.toFixed(2)
		return `M0,${rp} L-${xf},${yf} A${r},${r} 0 1 1 ${xf},${yf} Z`
	}
}
