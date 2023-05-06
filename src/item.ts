import type {Server} from './net'
import {makeDateOutput} from './date'
import type {
	UserDbRecord, UserItemCommentDbRecord,
	ChangesetDbRecord, ChangesetCommentDbRecord,
	NoteDbRecord, NoteCommentDbRecord
} from './db'
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
	const [$item,$flow]=makeItemCell(
		'changeset',$icon,changeset.id,
		server.web.getUrl(e`changeset/${changeset.id}`),
		server.api.getUrl(e`changeset/${changeset.id}.json?include_discussion=true`)
	)
	$flow.append(
		makeDate(),` `,
		makeChanges(),` `,
		makeElement('span')()(changeset.tags?.comment ?? '')
	)
	if (isClosed) $item.classList.add('closed')
	return $item
}

export function makeNoteCell(server: Server, note: NoteDbRecord): HTMLElement {
	const $icon=makeElement('span')('icon')()
	$icon.innerHTML=makeNoteIconHtml()
	$icon.title=`note ${note.id}`
	const [$item,$flow]=makeItemCell(
		'note',$icon,note.id,
		server.web.getUrl(e`note/${note.id}`),
		server.api.getUrl(e`notes/${note.id}.json`)
	)
	$flow.append(
		makeDateOutput(note.createdAt),` `,
		note.openingComment ?? ''
	)
	return $item
}

export function makeUserCell(server: Server, user: Extract<UserDbRecord,{visible:true}>): HTMLElement {
	const $icon=makeElement('span')('icon')()
	$icon.title=`user ${user.id}`
	$icon.innerHTML=`<svg width="16" height="16"><use href="#user" /></svg>`
	const $flow=makeElement('span')('flow')(
		`account created at `,makeDateOutput(user.createdAt)
	)
	return makeDiv('item','user')(
		$icon,` `,$flow
	)
}

export function makeChangesetCommentCell(server: Server, comment: ChangesetCommentDbRecord, username?: string): HTMLElement {
	const [$cell,$flow]=makeCommentCell(comment,username)
	$flow.append(
		` : `,comment.text
	)
	return $cell
}

export function makeNoteCommentCell(server: Server, comment: NoteCommentDbRecord, username?: string): HTMLElement {
	const [$cell,$flow]=makeCommentCell(comment,username)
	$flow.append(
		` : `,comment.action,` : `,comment.text
	)
	return $cell
}

function makeCommentCell(comment: UserItemCommentDbRecord, username?: string): [$item:HTMLElement,$flow:HTMLElement] {
	let userString=`???`
	if (username!=null) {
		userString=username
	} else if (comment.uid!=null) {
		userString=`#{comment.uid}`
	}
	const $flow=makeElement('span')('flow')(
		makeDateOutput(comment.createdAt),` `,userString
	)
	return [makeDiv('item','comment')($flow),$flow]
}

function makeItemCell(
	type: string, $icon: HTMLElement, id: number,
	href: string, apiHref: string
): [$item:HTMLElement,$flow:HTMLElement] {
	const $flow=makeElement('span')('flow')(
		makeLink(String(id),href),` `,
		makeElement('span')('api')(
			`(`,makeLink(`api`,apiHref),`)`
		),` `,
	)
	const $item=makeDiv('item',type)(
		$icon,` `,$flow
	)
	return [$item,$flow]
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
