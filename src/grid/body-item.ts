import type {Server} from '../net'
import {makeDateOutput} from '../date'
import type {MuxBatchItem} from '../mux-user-item-db-stream'
import {makeElement, makeLink} from '../util/html'
import {makeEscapeTag} from '../util/escape'

const e=makeEscapeTag(encodeURIComponent)

export function getItemCheckbox($item: HTMLElement): HTMLInputElement|undefined {
	const $checkbox=$item.querySelector('.icon input')
	if ($checkbox instanceof HTMLInputElement) {
		return $checkbox
	}
}

export function getItemDisclosureButton($item: HTMLElement): HTMLButtonElement|undefined {
	const $button=$item.querySelector('button.disclosure')
	if ($button instanceof HTMLButtonElement) {
		return $button
	}
}

export function markChangesetItemAsCombined($item: HTMLElement, id: number|string): void {
	$item.classList.add('combined')
	const $checkbox=getItemCheckbox($item)
	if ($checkbox) $checkbox.title=`changeset ${id}`
}

export function markChangesetItemAsUncombined($item: HTMLElement, id: number|string): void {
	$item.classList.remove('combined')
	const $checkbox=getItemCheckbox($item)
	if ($checkbox) $checkbox.title=`opened changeset ${id}`
}

export function makeItemShell(
	{type,item}: MuxBatchItem,
	isExpanded: boolean
): [$item: HTMLElement, classNames: string[]] {
	let id: number
	const classNames: string[] = ['item']
	const $icon=makeElement('span')('icon')()
	if (type=='user') {
		classNames.push('user')
		id=item.id
		writeUserIcon($icon,id)
	} else if (type=='changeset' || type=='changesetClose') {
		classNames.push('changeset')
		id=item.id
		writeChangesetIcon($icon,id,type=='changesetClose')
		if (type=='changesetClose') classNames.push('closed')
	} else if (type=='note') {
		classNames.push('note')
		id=item.id
		writeNoteIcon($icon,id)
	} else if (type=='changesetComment' || type=='noteComment') {
		classNames.push('comment')
		id=item.itemId
		if (type=='noteComment') {
			classNames.push(item.action)
			writeCommentIcon($icon,id,'note',item.action)
		} else {
			writeCommentIcon($icon,id,'changeset')
		}
		if (item.uid!=item.itemUid) {
			classNames.push('incoming')
		}
	}
	return [makeElement('span')()(
		$icon,` `,makeElement('span')('ballon')(
			makeItemDisclosureButton(isExpanded),` `,makeElement('span')('flow')()
		)
	),classNames]
}

export function writeCollapsedItemFlow(
	$flow: HTMLElement,
	server: Server,
	type: string,
	id: number
): void {
	if (type=='user') {
		$flow.replaceChildren(
			`account created`
		)
	} else if (type=='changeset' || type=='changesetClose' || type=='changesetComment') {
		const href=server.web.getUrl(e`changeset/${id}`)
		$flow.replaceChildren(
			makeLink(String(id),href)
		)
	} else if (type=='note' || type=='noteComment') {
		const href=server.web.getUrl(e`note/${id}`)
		$flow.replaceChildren(
			makeLink(String(id),href)
		)
	}
}

export function writeExpandedItemFlow(
	$flow: HTMLElement,
	server: Server,
	{type,item}: MuxBatchItem,
	usernames: Map<number, string>
): void {
	const rewriteWithLinks=(id: number, href: string, apiHref: string)=>{
		$flow.replaceChildren(
			makeLink(String(id),href),` `,
			makeElement('span')('api')(
				`(`,makeLink(`api`,apiHref),`)`
			)
		)
	}
	const rewriteWithChangesetLinks=(id: number)=>{
		rewriteWithLinks(id,
			server.web.getUrl(e`changeset/${id}`),
			server.api.getUrl(e`changeset/${id}.json?include_discussion=true`)
		)
	}
	const rewriteWithNoteLinks=(id: number)=>{
		rewriteWithLinks(id,
			server.web.getUrl(e`note/${id}`),
			server.api.getUrl(e`notes/${id}.json`)
		)
	}
	let from: string|HTMLElement|undefined
	let date: Date|undefined
	if (type=='user') {
		date=item.createdAt
		$flow.replaceChildren(
			`account created`
		)
	} else if (type=='changeset' || type=='changesetClose') {
		const makeChanges=()=>{
			const $changes=makeElement('span')('changes')(`Δ ${item.changes.count}`)
			$changes.title=`number of changes`
			return $changes
		}
		date = type=='changesetClose' ? item.closedAt : item.createdAt
		rewriteWithChangesetLinks(item.id)
		$flow.append(
			` `,makeChanges(),
			` `,makeElement('span')()(item.tags?.comment ?? '')
		)
	} else if (type=='note') {
		date=item.createdAt
		rewriteWithNoteLinks(item.id)
		if (item.openingComment) {
			$flow.append(
				` `,item.openingComment
			)
		}
	} else if (type=='changesetComment' || type=='noteComment') {
		date=item.createdAt
		let username: string|undefined
		if (item.uid) {
			username=usernames.get(item.uid)
		}
		let action: string|undefined
		if (type=='changesetComment') {
			rewriteWithChangesetLinks(item.itemId)
		} else if (type=='noteComment') {
			rewriteWithNoteLinks(item.itemId)
			action=item.action
		} else {
			return
		}
		if (item.uid!=item.itemUid) {
			if (username!=null) {
				from=makeLink(username,server.web.getUrl(e`user/${username}`))
				
			} else if (item.uid!=null) {
				from=`#{comment.uid}`
			} else {
				from=`anonymous`
			}
		}
		if (item.text) {
			$flow.append(
				` `,item.text
			)
		}
	} else {
		return
	}
	$flow.prepend(
		date?makeDateOutput(date):`???`,` `
	)
	if (from!=null) {
		$flow.prepend(
			makeElement('span')('from')(from),` `
		)
	}
}

function writeUserIcon($icon: HTMLElement, id: number): void {
	$icon.title=`user ${id}`
	$icon.innerHTML=makeCenteredSvg(10,
		`<path d="${computeNewOutlinePath(9,7,10)}" fill="canvas" stroke="currentColor" stroke-width="2" />`+
		makeUserSvgElements()
	)
}

function writeChangesetIcon($icon: HTMLElement, id: number, isClosed: boolean): void {
	if (isClosed) {
		const $noCheckbox=makeElement('span')('no-checkbox')()
		$noCheckbox.tabIndex=0
		$noCheckbox.title=`closed changeset ${id}`
		$icon.append($noCheckbox)
	} else {
		const $checkbox=makeElement('input')()()
		$checkbox.type='checkbox'
		$checkbox.title=`opened changeset ${id}`
		$icon.append($checkbox)
	}
}

function writeNoteIcon($icon: HTMLElement, id: number): void {
	$icon.title=`note ${id}`
	const s=3
	$icon.innerHTML=makeCenteredSvg(10,
		`<path d="${computeNewOutlinePath(9.5,8,10)}" fill="none" stroke="currentColor" stroke-width="1" />`+
		`<path d="${computeMarkerOutlinePath(16,6)}" fill="canvas" stroke="currentColor" stroke-width="2" />`+
		`<line x1="${-s}" x2="${s}" stroke="currentColor" stroke-width="2" />`+
		`<line y1="${-s}" y2="${s}" stroke="currentColor" stroke-width="2" />`
	)
}

function writeCommentIcon($icon: HTMLElement, id: number, itemType: 'note'|'changeset', action?: string): void {
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
		$icon.title=`comment for ${itemType} ${id}`
	} else {
		$icon.title=`${action} ${itemType} ${id}`
	}
}

function makeItemDisclosureButton(isExpanded: boolean): HTMLButtonElement {
	const $disclosure=makeElement('button')('disclosure')()
	setItemDisclosureButtonState($disclosure,isExpanded)
	const r=5.5
	const s=3.5
	$disclosure.innerHTML=makeCenteredSvg(r,
		`<line x1="${-s}" x2="${s}" stroke="currentColor" />`+
		`<line y1="${-s}" y2="${s}" stroke="currentColor" class='vertical-stroke' />`
	)
	return $disclosure
}

export function setItemDisclosureButtonState($disclosure: HTMLButtonElement, isExpanded: boolean): void {
	$disclosure.setAttribute('aria-expanded',String(isExpanded))
	$disclosure.title=(isExpanded?`Collapse`:`Expand`)+` item info`
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
