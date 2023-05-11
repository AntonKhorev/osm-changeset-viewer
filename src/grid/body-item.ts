import type {Server} from '../net'
import {makeDateOutput} from '../date'
import type {
	UserDbRecord, UserItemCommentDbRecord,
	ChangesetDbRecord, NoteDbRecord
} from '../db'
import type {GridBatchItem} from '../mux-user-item-db-stream-messenger'
import {makeElement, makeDiv, makeLink} from '../util/html'
import {makeEscapeTag} from '../util/escape'

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

export function renderExpandedItem(
	server: Server,
	{type,item}: GridBatchItem,
	usernames: Map<number, string>
): HTMLElement|null {
	if (type=='user') {
		return makeUserCell(server,item)
	} else if (type=='changeset' || type=='changesetClose') {
		return makeChangesetCell(server,item,type=='changesetClose')
	} else if (type=='note') {
		return makeNoteCell(server,item)
	} else if (type=='changesetComment' || type=='noteComment') {
		let username: string|undefined
		if (item.uid) {
			username=usernames.get(item.uid)
		}
		if (type=='noteComment') {
			return makeCommentCell(server,'note',item,username,item.action)
		} else {
			return makeCommentCell(server,'changeset',item,username)
		}
	} else {
		return null
	}
}

function makeChangesetCell(server: Server, changeset: ChangesetDbRecord, isClosed: boolean): HTMLElement {
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
	const date = isClosed ? changeset.closedAt : changeset.createdAt
	const $flow=makeElement('span')('flow')()
	const $cell=makeBasicChangesetCell(
		server,'changeset',date,$icon,$flow,changeset.id
	)
	$flow.append(
		makeChanges(),` `,
		makeElement('span')()(changeset.tags?.comment ?? '')
	)
	if (isClosed) $cell.classList.add('closed')
	return $cell
}

function makeNoteCell(server: Server, note: NoteDbRecord): HTMLElement {
	const $icon=makeElement('span')('icon')()
	$icon.title=`note ${note.id}`
	const s=3
	$icon.innerHTML=makeCenteredSvg(10,
		`<path d="${computeNewOutlinePath(9.5,8,10)}" fill="none" stroke="currentColor" stroke-width="1" />`+
		`<path d="${computeMarkerOutlinePath(16,6)}" fill="canvas" stroke="currentColor" stroke-width="2" />`+
		`<line x1="${-s}" x2="${s}" stroke="currentColor" stroke-width="2" />`+
		`<line y1="${-s}" y2="${s}" stroke="currentColor" stroke-width="2" />`
	)
	const $flow=makeElement('span')('flow')()
	const $cell=makeBasicNoteCell(
		server,'note',note.createdAt,$icon,$flow,note.id
	)
	$flow.append(
		note.openingComment ?? ''
	)
	return $cell
}

function makeUserCell(server: Server, user: Extract<UserDbRecord,{visible:true}>): HTMLElement {
	const $icon=makeElement('span')('icon')()
	$icon.title=`user ${user.id}`
	$icon.innerHTML=makeCenteredSvg(10,
		`<path d="${computeNewOutlinePath(9,7,10)}" fill="canvas" stroke="currentColor" stroke-width="2" />`+
		makeUserSvgElements()
	)
	const $flow=makeElement('span')('flow')(
		`account created`
	)
	return makeItemCell('user',user.createdAt,$icon,$flow)
}

function makeCommentCell(
	server: Server, itemType: 'note'|'changeset',
	comment: UserItemCommentDbRecord, username: string|undefined,
	action?: string
): HTMLElement {
	const $icon=makeElement('span')('icon')()
	if (itemType=='note') {
		const s=2.5
		let actionGlyph: string|undefined
		if (action=='closed') {
			actionGlyph=`<path d="M${-s},0 L0,${s} L${s},${-s}" fill="none" stroke="currentColor" stroke-width="2" />`
		} else if (action=='reopened') {
			actionGlyph=
				`<line x1="${-s}" x2="${s}" y1="${-s}" y2="${s}" stroke="currentColor" stroke-width="2" />`+
				`<line x1="${-s}" x2="${s}" y1="${s}" y2="${-s}" stroke="currentColor" stroke-width="2" />`
		} else if (action=='hidden') {
			actionGlyph=``
		}
		if (actionGlyph!=null) {
			$icon.innerHTML=makeCenteredSvg(10,
				`<path d="${computeMarkerOutlinePath(16,6)}" fill="canvas" stroke="currentColor" stroke-width="2" />`+
				actionGlyph
			)
		} else {
			const r=4
			$icon.innerHTML=makeCenteredSvg(r,`<circle r=${r} fill="currentColor" />`)
		}
	} else {
		const r=4
		$icon.innerHTML=makeCenteredSvg(r,`<rect x="${-r}" y="${-r}" width="${2*r}" height="${2*r}" fill="currentColor" />`)
	}
	if (action==null) {
		$icon.title=`comment for ${itemType} ${comment.itemId}`
	} else {
		$icon.title=`${action} ${itemType} ${comment.itemId}`
	}
	const $flow=makeElement('span')('flow')()
	const $cell=(itemType=='note' ? makeBasicNoteCell : makeBasicChangesetCell)(
		server,'comment',comment.createdAt,$icon,$flow,comment.itemId
	)
	if (action!=null) {
		$cell.classList.add(action)
	}
	if (comment.uid!=comment.itemUid) {
		$cell.classList.add('incoming')
		let from:string|HTMLElement=`???`
		if (username!=null) {
			from=makeLink(username,server.web.getUrl(e`user/${username}`))
			
		} else if (comment.uid!=null) {
			from=`#{comment.uid}`
		}
		$flow.prepend(
			makeElement('span')('from')(from),` `
		)
	}
	$flow.append(
		` `,comment.text
	)
	return $cell
}

function makeBasicChangesetCell(
	server: Server,
	type: string, date: Date|undefined, $icon: HTMLElement, $flow: HTMLElement,
	id: number
): HTMLElement {
	return makeLinkedItemCell(
		type,date,$icon,$flow,id,
		server.web.getUrl(e`changeset/${id}`),
		server.api.getUrl(e`changeset/${id}.json?include_discussion=true`)
	)
}

function makeBasicNoteCell(
	server: Server,
	type: string, date: Date|undefined, $icon: HTMLElement, $flow: HTMLElement,
	id: number
): HTMLElement {
	return makeLinkedItemCell(
		type,date,$icon,$flow,id,
		server.web.getUrl(e`note/${id}`),
		server.api.getUrl(e`notes/${id}.json`)
	)
}

function makeLinkedItemCell(
	type: string, date: Date|undefined, $icon: HTMLElement, $flow: HTMLElement,
	id: number, href: string, apiHref: string
): HTMLElement {
	$flow.append(
		makeLink(String(id),href),` `,
		makeElement('span')('api')(
			`(`,makeLink(`api`,apiHref),`)`
		),` `,
	)
	return makeItemCell(type,date,$icon,$flow)
}

function makeItemCell(
	type: string, date: Date|undefined, $icon: HTMLElement, $flow: HTMLElement
): HTMLElement {
	const $disclosure=makeElement('button')('disclosure')()
	$disclosure.title=`Expand item info`
	const r=5.5
	const s=3.5
	$disclosure.innerHTML=makeCenteredSvg(r,
		`<line x1="${-s}" x2="${s}" stroke="currentColor" />`+
		`<line y1="${-s}" y2="${s}" stroke="currentColor" />`
	)
	$flow.prepend(
		date?makeDateOutput(date):`???`,` `
	)
	return makeDiv('item',type)(
		$icon,` `,makeElement('span')('ballon')($disclosure,` `,$flow)
	)
}

export function makeCenteredSvg(r: number, content: string): string {
	return `<svg width="${2*r}" height="${2*r}" viewBox="${-r} ${-r} ${2*r} ${2*r}">${content}</svg>`
}

function computeMarkerOutlinePath(h: number, r: number): string {
	const rp=h-r
	const y=r**2/rp
	const x=Math.sqrt(r**2-y**2)
	const xf=x.toFixed(2)
	const yf=y.toFixed(2)
	return `M0,${rp} L-${xf},${yf} A${r},${r} 0 1 1 ${xf},${yf} Z`
}

function computeNewOutlinePath(R: number, r: number, n: number): string {
	let outline=``
	for (let i=0;i<n*2;i++) {
		const a=Math.PI*i/n
		const s=i&1?r:R
		outline+=(i?'L':'M')+
			(s*Math.cos(a)).toFixed(2)+','+
			(s*Math.sin(a)).toFixed(2)
	}
	outline+='Z'
	return outline
}

export function makeUserSvgElements(): string {
	return (
		`<circle cx="0" cy="-2" r="2.5" fill="currentColor" />`+
		`<path d="M -4,5.5 A 4 4 0 0 1 4,5.5 Z" fill="currentColor" />`
	)
}
