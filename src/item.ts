import type {Server} from './net'
import {makeDateOutput} from './date'
import type {UserDbRecord, ChangesetDbRecord, NoteDbRecord} from './db'
import {makeElement, makeDiv, makeLink} from './util/html'
import {makeEscapeTag} from './util/escape'

const e=makeEscapeTag(encodeURIComponent)

export function getItemCheckbox($item: HTMLElement): HTMLInputElement|undefined {
	const $checkbox=$item.querySelector('.icon input')
	if ($checkbox instanceof HTMLInputElement) {
		return $checkbox
	}
}

export function markChangesetCellAsCombined($item: HTMLElement, id: number|string): void {
	$item.classList.add('combined')
	const $checkbox=getItemCheckbox($item)
	if ($checkbox) $checkbox.title=`changeset ${id}`
}

export function markChangesetCellAsUncombined($item: HTMLElement, id: number|string): void {
	$item.classList.remove('combined')
	const $checkbox=getItemCheckbox($item)
	if ($checkbox) $checkbox.title=`opened changeset ${id}`
}

export function makeChangesetCell(server: Server, changeset: ChangesetDbRecord, isClosed: boolean): HTMLElement {
	const makeDate=()=>{
		const date=isClosed ? changeset.closedAt : changeset.createdAt
		return date ? makeDateOutput(date) : `???`
	}
	const makeChanges=()=>{
		const $changes=makeElement('span')('changes')(`Δ ${changeset.changes.count}`)
		$changes.title=`number of changes`
		return $changes
	}
	let $icon: HTMLElement
	if (isClosed) {
		const $noCheckbox=makeElement('span')('no-checkbox')()
		$noCheckbox.tabIndex=0
		$noCheckbox.title=`closed changeset ${changeset.id}`
		$icon=makeElement('span')('icon')($noCheckbox)
	} else {
		const $checkbox=makeElement('input')()()
		$checkbox.type='checkbox'
		$checkbox.title=`opened changeset ${changeset.id}`
		$icon=makeElement('span')('icon')($checkbox)
	}
	const $item=makeItemCell(
		'changeset',$icon,changeset.id,
		server.web.getUrl(e`changeset/${changeset.id}`),
		server.api.getUrl(e`changeset/${changeset.id}.json?include_discussion=true`)
	)
	$item.append(
		makeDate(),` `,
		makeChanges(),` `,
		changeset.tags?.comment ?? ''
	)
	if (isClosed) $item.classList.add('closed')
	return $item
}

export function makeNoteCell(server: Server, note: NoteDbRecord): HTMLElement {
	const $icon=makeElement('span')('icon')()
	$icon.innerHTML=makeNoteIconHtml()
	$icon.title=`note ${note.id}`
	const $item=makeItemCell(
		'note',$icon,note.id,
		server.web.getUrl(e`note/${note.id}`),
		server.api.getUrl(e`notes/${note.id}.json`)
	)
	$item.append(
		makeDateOutput(note.createdAt),` `,
		note.openingComment ?? ''
	)
	return $item
}

export function makeUserCell(server: Server, user: Extract<UserDbRecord,{visible:true}>): HTMLElement {
	const $icon=makeElement('span')('icon')()
	$icon.title=`user ${user.id}`
	$icon.innerHTML=`<svg width="16" height="16"><use href="#user" /></svg>`
	return makeDiv('item','user')(
		$icon,` account created at `,makeDateOutput(user.createdAt)
	)
}

function makeItemCell(
	type: string, $icon: HTMLElement, id: number,
	href: string, apiHref: string
): HTMLElement {
	const $item=makeDiv('item',type)(
		$icon,` `,
		makeLink(String(id),href),` `,
		makeElement('span')('api')(
			`(`,makeLink(`api`,apiHref),`)`
		),` `,
	)
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
