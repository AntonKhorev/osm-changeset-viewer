import {getHueFromUid} from './colorizer'
import type {EditorIcon} from './editors'
import editorData from './editors'
import type ItemOptions from './item-options'
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
	const $balloon=makeElement('span')('balloon')(
		makeItemDisclosureButton(isExpanded),` `,
		makeElement('span')('flow')(),
	)
	const $item=makeElement('span')('item')()
	if (type=='user') {
		$item.classList.add('user')
		id=item.id
		writeNewUserIcon($icon,id)
		setColor($icon,item.id)
		setColor($balloon,item.id)
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
		setColor($balloon,item.uid)
	} else if (type=='note') {
		$item.classList.add('note')
		id=item.id
		writeNoteIcon($icon,id)
		setColor($icon,item.uid)
		setColor($balloon,item.uid)
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
			$icon.title=`${item.action} note ${id}`
			commentIconSvg=getSvgOfCommentIcon('note',item.action)
		} else {
			$item.classList.add('passive')
			$icon.title=`comment for changeset ${id}`
			commentIconSvg=getSvgOfCommentIcon('changeset')
		}
		setColor($icon,item.itemUid)
		setColor($balloon,item.uid)
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
	$item.append($icon,$balloon)
	if ($senderIcon) {
		$item.append($senderIcon)
	}
	return $item
}

export function trimToCollapsedItemFlow(
	$flow: HTMLElement,
	itemOptions: ItemOptions
): void {
	const $pieces: HTMLElement[] = []
	for (const {get,name} of itemOptions.list) {
		const $piece=$flow.querySelector(`:scope > [data-optional="${name}"]`)
		if (!($piece instanceof HTMLElement)) continue
		$piece.hidden=!get()
		$pieces.push($piece)
	}
	$flow.replaceChildren()
	let metVisiblePiece=false
	for (const $piece of $pieces) {
		if (!$piece.hidden && metVisiblePiece) $flow.append(' ')
		metVisiblePiece||=!$piece.hidden
		$flow.append($piece)
	}
}

export function writeExpandedItemFlow(
	$flow: HTMLElement,
	server: ServerUrlGetter,
	{type,item}: MuxBatchItem,
	usernames: Map<number, string>,
	itemOptions: ItemOptions
): void {
	const optionalize=(name:keyof ItemOptions,$e:HTMLElement)=>{
		$e.dataset.optional=name
		$e.hidden=!itemOptions[name]
		return $e
	}
	const makeBadge=(contents:(string|HTMLElement)[],title?:string,isEmpty=false)=>{
		const $badge=makeElement('span')('badge')(...contents)
		if (title) $badge.title=title
		if (isEmpty) $badge.classList.add('empty')
		return $badge
	}
	const makeKnownEditorBadgeOrIcon=(createdBy: string, editorIcon: EditorIcon, url: string)=>{
		const $a=makeLink(``,url)
		if (editorIcon.type=='svg') {
			$a.innerHTML=`<svg width="16" height="16"><use href="#editor-${editorIcon.id}" /></svg>`
		} else if (editorIcon.type=='data') {
			$a.innerHTML=`<img width="16" height="16" src="${editorIcon.data}">`
		} else {
			$a.textContent=`🛠️ `+editorIcon.name
			return makeBadge([$a],createdBy)
		}
		$a.title=createdBy
		$a.classList.add('editor')
		return $a
	}
	const makeEditorBadgeOrIconFromCreatedBy=(createdBy: string)=>{
		if (!createdBy) {
			return makeBadge([`🛠️ ?`],`unknown editor`)
		}
		for (const [createdByPrefix,url,editorIcon] of editorData) {
			for (const createdByValue of createdBy.split(';')) {
				if (createdByValue.toLowerCase().startsWith(createdByPrefix.toLowerCase())) {
					return makeKnownEditorBadgeOrIcon(createdBy,editorIcon,url)
				}
			}
		}
		let createdByLead=createdBy
		const match=createdBy.match(/(.*)(\/|\s+|v)\d/)
		if (match && match[1]) {
			createdByLead=match[1]
		}
		return makeBadge([`🛠️ ${createdByLead??'?'}`],createdBy)
	}
	const makeEditorBadgeOrIconFromNoteComment=(comment: string)=>{
		for (const [,url,editorIcon,noteRegExp] of editorData) {
			if (!noteRegExp) continue
			let match
			if (match=comment.match(noteRegExp)) {
				const [,createdBy]=match
				return makeKnownEditorBadgeOrIcon(createdBy,editorIcon,url)
			}
		}
		return null
	}
	const makeCommentsBadge=(uid: number, commentRefs: {uid?:number,mute?:boolean}[])=>{
		const getBalloonRefHtml=(incoming=false,mute=false)=>{
			const flip=incoming?` transform="scale(-1,1)"`:``
			const balloonColors=`fill="transparent" stroke="currentColor"`
			let balloon:string
			if (mute) {
				balloon=`<g${flip} ${balloonColors}>`+
					`<circle class="balloon-ref" r="6" />`+
					`<circle class="balloon-ref" r="2" cx="-6" cy="4" />`+
				`</g>`
			} else {
				const balloonPathData=`M-8,0 l2,-2 V-4 a2,2 0 0 1 2,-2 H4 a2,2 0 0 1 2,2 V4 a2,2 0 0 1 -2,2 H-4 a2,2 0 0 1 -2,-2 V2 Z`
				balloon=`<path class="balloon-ref"${flip} d="${balloonPathData}" ${balloonColors} />`
			}
			return `<svg width="15" height="13" viewBox="${incoming?-6.5:-8.5} -6.5 15 13">`+
				balloon+
				`<circle r=".7" fill="currentColor" cx="-3" />`+
				`<circle r=".7" fill="currentColor" />`+
				`<circle r=".7" fill="currentColor" cx="3" />`+
			`</svg>`
		}
		if (commentRefs.length>0) {
			const contents:(string|HTMLElement)[]=[]
			for (const [i,commentRef] of commentRefs.entries()) {
				if (i) contents.push(` `)
				const $button=makeElement('button')('comment-ref')()
				$button.dataset.order=String(i)
				$button.title=`comment ${i+1}`
				$button.innerHTML=getBalloonRefHtml(commentRef.uid!=uid,commentRef.mute)
				contents.push($button)
			}
			return makeBadge(contents)
		} else {
			const $noButton=makeElement('span')('comment-ref')()
			$noButton.innerHTML=getBalloonRefHtml()
			return makeBadge([$noButton],`no comments`,true)
		}
	}
	const makeSourceBadge=(source: string|undefined)=>{
		const bracket=(text:string)=>[
			makeElement('span')('delimiter')(`[`),
			text,
			makeElement('span')('delimiter')(`]`)
		]
		if (source) {
			return makeBadge(bracket(source),`source`)
		} else {
			return makeBadge(bracket(`?`),`unspecified source`,true)
		}
	}
	const rewriteWithLinks=(id: number, href: string, apiHref: string)=>{
		$flow.replaceChildren(
			optionalize('id',makeLink(String(id),href)),` `,
			optionalize('api',makeBadge([makeLink(`api`,apiHref)]))
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
			optionalize('id',makeElement('span')()(`account created`)) // abuse id slot for this text
		)
	} else if (type=='changeset' || type=='changesetClose') {
		date = type=='changesetClose' ? item.closedAt : item.createdAt
		rewriteWithChangesetLinks(item.id)
		$flow.append(
			` `,optionalize('editor',makeEditorBadgeOrIconFromCreatedBy(item.tags.created_by)),
			` `,optionalize('source',makeSourceBadge(item.tags.source)),
			` `,optionalize('changes',makeBadge([`📝 ${item.changes.count}`],`number of changes`)),
			` `,optionalize('comments',makeCommentsBadge(item.uid,item.commentRefs))
		)
		if (item.tags?.comment) {
			$flow.append(
				` `,optionalize('comment',makeElement('span')()(item.tags?.comment ?? ''))
			)
		}
	} else if (type=='note') {
		date=item.createdAt
		rewriteWithNoteLinks(item.id)
		if (item.openingComment) {
			const $editorBadge=makeEditorBadgeOrIconFromNoteComment(item.openingComment)
			if ($editorBadge) {
				$flow.append(
					` `,optionalize('editor',$editorBadge)
				)
			}
		}
		$flow.append(
			` `,optionalize('comments',makeCommentsBadge(item.uid,item.commentRefs))
		)
		if (item.openingComment) {
			$flow.append(
				` `,optionalize('comment',makeElement('span')()(item.openingComment))
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
				` `,optionalize('comment',makeElement('span')()(item.text))
			)
		}
	} else {
		return
	}
	if (date) {
		$flow.prepend(
			optionalize('date',makeDateOutput(date)),` `
		)
	}
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
		`<rect x="${c1}" y="${c1}" width="${2*r}" height="${2*r}" />`+
		`<rect x="${c1}" y="${c2}" width="${2*r}" height="${2*r}" />`+
		`<rect x="${c2}" y="${c1}" width="${2*r}" height="${2*r}" />`+
		`<rect x="${c2}" y="${c2}" width="${2*r}" height="${2*r}" />`+
		`<rect x="${-r}" y="${-r}" width="${2*r}" height="${2*r}" />`,
	`fill="currentColor"`)
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
		const $button=makeElement('button')('ref')()
		$button.title=`closed changeset ${id}`
		$button.innerHTML=makeCenteredSvg(6+size,
			`<line y1="-5" y2="5" />`+
			`<path d="M-5,0 L0,5 L5,0" fill="none" />`,
		`stroke="currentColor" stroke-width="2"`)
		$icon.append($button)
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
		`<path d="${computeNewOutlinePath(9.5,8,10)}" fill="none" stroke-width="1" />`+
		`<path d="${computeMarkerOutlinePath(16,6)}" fill="canvas" />`+
		`<line x1="${-s}" x2="${s}" />`+
		`<line y1="${-s}" y2="${s}" />`,
	`stroke="currentColor" stroke-width="2"`)
}

function getSvgOfCommentIcon(itemType: 'note'|'changeset', action?: string): string {
	if (itemType=='note') {
		const s=2.5
		let actionGlyph: string|undefined
		if (action=='closed') {
			actionGlyph=`<path d="M${-s},0 L0,${s} L${s},${-s}" fill="none" />`
		} else if (action=='reopened') {
			actionGlyph=
				`<line x1="${-s}" x2="${s}" y1="${-s}" y2="${s}" />`+
				`<line x1="${-s}" x2="${s}" y1="${s}" y2="${-s}" />`
		} else if (action=='hidden') {
			actionGlyph=``
		}
		if (actionGlyph!=null) {
			return makeCenteredSvg(10,
				`<path d="${computeMarkerOutlinePath(16,6)}" fill="canvas" />`+
				actionGlyph,
			`stroke="currentColor" stroke-width="2"`)
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
	return `<svg class="tip" width="7" height="13" viewBox="${side<0?-.5:-5.5} -6.5 7 13" fill="canvas">`+
		`<path d="M0,0L${-7*side},7V-7Z" class="balloon-part"></path>`+
		`<path d="M${-6*side},-6L0,0L${-6*side},6" fill="none" stroke="var(--balloon-frame-color)"></path>`+
	`</svg>`
}
function getSvgOfMuteCommentTip(side: -1|1): string {
	return `<svg class="tip" width="15" height="20" viewBox="${side<0?0:-15} -10 15 20" fill="canvas" stroke="var(--balloon-frame-color)">`+
		`<circle cx="${-10.5*side}" cy="-3.5" r="4" class="balloon-part" />`+
		`<circle cx="${-5.5*side}" cy="1.5" r="2" class="balloon-part" />`+
	`</svg>`
}

function makeItemDisclosureButton(isExpanded: boolean): HTMLButtonElement {
	const $disclosure=makeElement('button')('disclosure')()
	setItemDisclosureButtonState($disclosure,isExpanded)
	const r=5.5
	const s=3.5
	$disclosure.innerHTML=makeCenteredSvg(r,
		`<line x1="${-s}" x2="${s}" />`+
		`<line y1="${-s}" y2="${s}" class="vertical-stroke" />`,
	`stroke="currentColor"`)
	return $disclosure
}

export function getItemDisclosureButtonState($disclosure: HTMLButtonElement): boolean {
	return $disclosure.getAttribute('aria-expanded')=='true'
}
export function setItemDisclosureButtonState($disclosure: HTMLButtonElement, isExpanded: boolean): void {
	$disclosure.setAttribute('aria-expanded',String(isExpanded))
	$disclosure.title=(isExpanded?`Collapse`:`Expand`)+` item info`
}

export function makeCenteredSvg(r: number, content: string, attrs?: string): string {
	return `<svg width="${2*r}" height="${2*r}" viewBox="${-r} ${-r} ${2*r} ${2*r}"${attrs?' '+attrs:''}>${content}</svg>`
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
		$e.style.setProperty('--balloon-frame-color','hsl(0 0% var(--light-frame-lightness))')
		$e.style.setProperty('--accent-color','var(--light-text-color)');
	}
}
