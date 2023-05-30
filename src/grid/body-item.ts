import {getHueFromUid} from './colorizer'
import {makeDateOutput} from '../date'
import type {MuxBatchItem} from '../mux-user-item-db-stream'
import {makeElement, makeLink} from '../util/html'
import {makeEscapeTag} from '../util/escape'

export interface ServerUrlGetter {
	web: {
		getUrl(path:string): string
	},
	api: {
		getUrl(path:string): string
	}
}

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

export function makeItemShell(
	{type,item}: MuxBatchItem,
	isExpanded: boolean,
	usernames: Map<number, string>
): HTMLElement {
	let id: number
	const $icon=makeElement('span')('icon')()
	let $senderIcon: HTMLElement|undefined
	const $ballon=makeElement('span')('ballon')(
		makeItemDisclosureButton(isExpanded),` `,
		makeElement('span')('flow')(),
	)
	const $item=makeElement('span')('item')()
	if (type=='user') {
		$item.classList.add('user')
		id=item.id
		writeNewUserIcon($icon,id)
		setColor($icon,item.id)
		setColor($ballon,item.id)
	} else if (type=='changeset' || type=='changesetClose') {
		$item.classList.add('changeset')
		if (type=='changesetClose') $item.classList.add('closed')
		id=item.id
		let size=0
		if (item.changes.count>0) {
			const cappedChangesCount=Math.min(9999,item.changes.count)
			size=1+Math.floor(Math.log10(cappedChangesCount))
		}
		$icon.dataset.size=String(size)
		writeChangesetIcon($icon,id,type=='changesetClose',size)
		setColor($icon,item.uid)
		setColor($ballon,item.uid)
	} else if (type=='note') {
		$item.classList.add('note')
		id=item.id
		writeNoteIcon($icon,id)
		setColor($icon,item.uid)
		setColor($ballon,item.uid)
	} else if (type=='changesetComment' || type=='noteComment') {
		$item.classList.add('comment')
		if (!item.text) $item.classList.add('mute')
		id=item.itemId
		let commentIconSvg: string
		if (type=='noteComment') {
			if (item.action=='commented') {
				$item.classList.add('passive')
			} else {
				$item.classList.add(item.action)
			}
			$icon.title=`${item.action} 'note' ${id}`
			commentIconSvg=getSvgOfCommentIcon('note',item.action)
		} else {
			$item.classList.add('passive')
			$icon.title=`comment for changeset ${id}`
			commentIconSvg=getSvgOfCommentIcon('changeset')
		}
		setColor($icon,item.itemUid)
		setColor($ballon,item.uid)
		if (item.uid==item.itemUid) {
			$icon.innerHTML=commentIconSvg+(item.text
				? getSvgOfCommentTip(-1)
				: getSvgOfMuteCommentTip(-1)
			)
		} else {
			$icon.innerHTML=commentIconSvg
			$item.classList.add('incoming')
			$senderIcon=makeElement('span')('icon')()
			$senderIcon.classList.add('sender')
			setColor($senderIcon,item.uid)
			const username=item.uid?usernames.get(item.uid):undefined
				if (username!=null) {
				$senderIcon.title=username
			} else if (item.uid!=null) {
				$senderIcon.title=`#`+item.uid
			} else {
				$senderIcon.title=`anonymous`
			}
			if (item.uid!=null) {
				const hue=getHueFromUid(item.uid)
				$senderIcon.style.setProperty('--hue',String(hue))
			}
			$senderIcon.innerHTML=getSvgOfSenderUserIcon()+(item.text
				? getSvgOfCommentTip(1)
				: getSvgOfMuteCommentTip(1)
			)
		}
	}
	$item.append($icon,$ballon)
	if ($senderIcon) {
		$item.append($senderIcon)
	}
	return $item
}

export function writeCollapsedItemFlow(
	$flow: HTMLElement,
	server: ServerUrlGetter,
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
	server: ServerUrlGetter,
	{type,item}: MuxBatchItem,
	usernames: Map<number, string>
): void {
	const makeBadge=(content:string|HTMLElement,title?:string)=>{
		const $badge=makeElement('span')('badge')(content)
		if (title) $badge.title=title
		return $badge
	}
	const makeEditorBadge=(createdBy: string)=>{
		if (!createdBy) {
			return makeBadge(`📝 ?`,`unknown editor`)
		}
		for (const [editorId,createdByPrefix,osmWikiName] of [
			['vespucci','Vespucci','Vespucci'],
		]) {
			if (!createdBy.startsWith(createdByPrefix)) continue
			const $a=makeLink(``,`https://wiki.openstreetmap.org/wiki/${osmWikiName}`,createdBy)
			$a.innerHTML=`<svg width="16" height="16"><use href="#editor-${editorId}" /></svg>`
			$a.classList.add('editor')
			return $a
		}
		return makeBadge(`📝 ${createdBy[0]}`,createdBy)
	}
	const rewriteWithLinks=(id: number, href: string, apiHref: string)=>{
		$flow.replaceChildren(
			makeLink(String(id),href),` `,
			makeBadge(makeLink(`api`,apiHref))
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
	let from: (string|HTMLElement)[] = []
	let date: Date|undefined
	if (type=='user') {
		date=item.createdAt
		$flow.replaceChildren(
			`account created`
		)
	} else if (type=='changeset' || type=='changesetClose') {
		date = type=='changesetClose' ? item.closedAt : item.createdAt
		rewriteWithChangesetLinks(item.id)
		$flow.append(
			` `,makeEditorBadge(item.tags.created_by),
			` `,makeBadge(`Δ ${item.changes.count}`,`number of changes`),
			` `,makeBadge(`💬 ${item.comments.count}`,`number of comments`),
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
		if (type=='changesetComment') {
			rewriteWithChangesetLinks(item.itemId)
		} else if (type=='noteComment') {
			rewriteWithNoteLinks(item.itemId)
		} else {
			return
		}
		if (item.uid!=item.itemUid) {
			const $senderIcon=makeElement('span')('icon')()
			$senderIcon.classList.add('sender')
			$senderIcon.innerHTML=getSvgOfSenderUserIcon()+(item.text
				? getSvgOfCommentTip(1)
				: ``
			)
			from.push($senderIcon)
			if (username!=null) {
				from.push(makeLink(username,server.web.getUrl(e`user/${username}`)))
			} else if (item.uid!=null) {
				from.push(`#${item.uid}`)
			} else {
				from.push(`anonymous`)
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
	if (from.length>0) {
		$flow.prepend(
			makeElement('span')('from')(...from),` `
		)
	}
}

export function makeCollectionIcon(): HTMLElement {
	const $icon=makeElement('span')('icon')()
	const r=4
	const c1=-10
	const c2=10-2*r
	$icon.innerHTML=makeCenteredSvg(10,
		`<rect x="${c1}" y="${c1}" width="${2*r}" height="${2*r}" fill="currentColor" />`+
		`<rect x="${c1}" y="${c2}" width="${2*r}" height="${2*r}" fill="currentColor" />`+
		`<rect x="${c2}" y="${c1}" width="${2*r}" height="${2*r}" fill="currentColor" />`+
		`<rect x="${c2}" y="${c2}" width="${2*r}" height="${2*r}" fill="currentColor" />`+
		`<rect x="${-r}" y="${-r}" width="${2*r}" height="${2*r}" fill="currentColor" />`
	)
	return $icon
}

function writeNewUserIcon($icon: HTMLElement, id: number|undefined): void {
	$icon.title=id!=null?`user ${id}`:`anonymous user`
	$icon.innerHTML=makeCenteredSvg(10,
		`<path d="${computeNewOutlinePath(9,7,10)}" fill="canvas" stroke="currentColor" stroke-width="2" />`+
		makeUserSvgElements()
	)
}

function getSvgOfSenderUserIcon(): string {
	return makeCenteredSvg(8,
		makeUserSvgElements()
	)
}

function writeChangesetIcon($icon: HTMLElement, id: number, isClosed: boolean, size: number): void {
	if (isClosed) {
		const $noCheckbox=makeCenteredSvg(6+size,
			`<line y1="-5" y2="5" stroke="currentColor" stroke-width="2" />`+
			`<path d="M-5,0 L0,5 L5,0" fill="none" stroke="currentColor" stroke-width="2" />`
		)
		$icon.tabIndex=0
		$icon.title=`closed changeset ${id}`
		$icon.innerHTML=$noCheckbox
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

function getSvgOfCommentIcon(itemType: 'note'|'changeset', action?: string): string {
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
			return makeCenteredSvg(10,
				`<path d="${computeMarkerOutlinePath(16,6)}" fill="canvas" stroke="currentColor" stroke-width="2" />`+
				actionGlyph
			)
		} else {
			const r=4
			return makeCenteredSvg(r,`<circle r=${r} fill="currentColor" />`)
		}
	} else {
		const r=4
		return makeCenteredSvg(r,`<rect x="${-r}" y="${-r}" width="${2*r}" height="${2*r}" fill="currentColor" />`)
	}
}

function getSvgOfCommentTip(side: -1|1): string {
	return `<svg class="tip" width="7" height="13" viewBox="${side<0?-.5:-5.5} -6.5 7 13">`+
		`<path d="M0,0L${-7*side},7V-7Z" fill="canvas"></path>`+
		`<path d="M${-6*side},-6L0,0L${-6*side},6" fill="none" stroke="var(--ballon-frame-color)"></path>`+
	`</svg>`
}
function getSvgOfMuteCommentTip(side: -1|1): string {
	return `<svg class="tip" width="15" height="20" viewBox="${side<0?0:-15} -10 15 20">`+
		`<circle cx="${-10.5*side}" cy="-3.5" r="4" fill="canvas" stroke="var(--ballon-frame-color)" />`+
		`<circle cx="${-5.5*side}" cy="1.5" r="2" fill="canvas" stroke="var(--ballon-frame-color)" />`+
	`</svg>`
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

export function getItemDisclosureButtonState($disclosure: HTMLButtonElement): boolean {
	return $disclosure.getAttribute('aria-expanded')=='true'
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

function setColor($e: HTMLElement, uid: number|undefined) {
	if (uid!=null) {
		const hue=getHueFromUid(uid)
		$e.style.setProperty('--hue',String(hue))
	} else {
		$e.style.setProperty('--ballon-frame-color','hsl(0 0% var(--light-frame-lightness))')
		$e.style.setProperty('--accent-color','var(--light-text-color)');
	}
}
