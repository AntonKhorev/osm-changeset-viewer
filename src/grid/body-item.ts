import type {EditorIcon} from './editors'
import editorData from './editors'
import makeProjectBadgeContentFromComment from './projects'
import type ItemOptions from './item-options'
import {readCollapsedItemCommentPieceText, writeCollapsedItemCommentPieceText, writeHueAttributes} from './info'
import {
	makeSvgOfUser, makeSvgOfNewUser, makeSvgOfNote, makeSvgOfComment,
	makeSvgOfClosedChangeset, makeSvgOfEmptyChangeset,
	makeSvgOfBalloonRef, makeSvgOfCommentTip, makeSvgOfMuteCommentTip
} from '../widgets'
import type Colorizer from '../colorizer'
import {makeDateOutput} from '../date'
import type {MuxBatchItem} from '../mux-user-item-db-stream'
import type {ChangesetDbRecord} from '../db'
import {makeDisclosureButton} from '../widgets'
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
	colorizer: Colorizer,
	{type,item}: MuxBatchItem,
	isExpanded: boolean,
	usernames: Map<number, string>
): HTMLElement {
	let id: number
	const $icon=makeElement('span')('icon')()
	let $senderIcon: HTMLElement|undefined
	const $balloon=makeElement('span')('balloon')(
		makeDisclosureButton(isExpanded,`item info`),` `,
		makeElement('span')('flow')(),
	)
	const $item=makeElement('span')('item')()
	if (type=='user') {
		$item.classList.add('user')
		id=item.id
		writeNewUserIcon($icon,id)
		writeHueAttributes(colorizer,$icon,item.id)
		writeHueAttributes(colorizer,$balloon,item.id)
	} else if (type=='changeset' || type=='changesetClose') {
		$item.classList.add('changeset')
		if (type=='changesetClose') $item.classList.add('closed')
		id=item.id
		let size=0
		if (item.changes.count>0) {
			const cappedChangesCount=Math.min(9999,item.changes.count)
			size=1+Math.floor(Math.log10(cappedChangesCount))
		} else {
			if (type!='changesetClose') {
				$item.classList.add('empty')
			}
		}
		$icon.dataset.size=String(size)
		writeChangesetIcon($icon,id,type=='changesetClose',item.changes.count==0,size)
		writeHueAttributes(colorizer,$icon,item.uid)
		writeHueAttributes(colorizer,$balloon,item.uid)
	} else if (type=='note') {
		$item.classList.add('note')
		id=item.id
		writeNoteIcon($icon,id)
		writeHueAttributes(colorizer,$icon,item.uid)
		writeHueAttributes(colorizer,$balloon,item.uid)
	} else if (type=='changesetComment' || type=='noteComment') {
		$item.classList.add('comment')
		if (!item.text) $item.classList.add('mute')
		id=item.itemId
		const $button=makeElement('button')('ref')()
		$icon.append($button)
		let commentIconSvg: string
		if (type=='noteComment') {
			$item.classList.add('for-note')
			if (item.action=='commented') {
				$item.classList.add('passive')
			} else {
				$item.classList.add(item.action)
			}
			$button.title=`${item.action} note ${id}`
			commentIconSvg=makeSvgOfComment('note',item.action)
		} else {
			$item.classList.add('for-changeset')
			$item.classList.add('passive')
			$button.title=`comment for changeset ${id}`
			commentIconSvg=makeSvgOfComment('changeset')
		}
		writeHueAttributes(colorizer,$icon,item.itemUid)
		writeHueAttributes(colorizer,$balloon,item.uid)
		if (item.uid==item.itemUid) {
			$button.innerHTML=commentIconSvg
			$icon.insertAdjacentHTML('beforeend',(item.text
				? makeSvgOfCommentTip(-1)
				: makeSvgOfMuteCommentTip(-1)
			))
		} else {
			$button.innerHTML=commentIconSvg
			$item.classList.add('incoming')
			$senderIcon=makeElement('span')('icon')()
			$senderIcon.classList.add('sender')
			writeHueAttributes(colorizer,$senderIcon,item.uid)
			const username=item.uid?usernames.get(item.uid):undefined
			if (username!=null) {
				$senderIcon.title=username
			} else if (item.uid!=null) {
				$senderIcon.title=`#`+item.uid
			} else {
				$senderIcon.title=`anonymous`
			}
			$senderIcon.innerHTML=makeSvgOfUser()+(item.text
				? makeSvgOfCommentTip(1)
				: makeSvgOfMuteCommentTip(1)
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
	type: string|undefined,
	itemOptions: ItemOptions
): void {
	const $pieces: HTMLElement[] = []
	for (const itemOption of itemOptions) {
		const $piece=$flow.querySelector(`:scope > [data-optional="${itemOption.name}"]`)
		if (!($piece instanceof HTMLElement)) continue
		$piece.hidden=!itemOption.get(type)
		if (itemOption.name=='comment') {
			const comment=readCollapsedItemCommentPieceText($piece)
			if (comment) writeCollapsedItemCommentPieceText($piece,comment)
		}
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
	colorizer: Colorizer,
	server: ServerUrlGetter,
	$flow: HTMLElement,
	{type,item}: MuxBatchItem,
	usernames: Map<number, string>,
	itemOptions: ItemOptions
): void {
	type CommentRef = {uid?:number,mute?:boolean,action?:string}
	const optionalize=(name:string,$e:HTMLElement)=>{
		$e.dataset.optional=name
		$e.hidden=!itemOptions.get(name)?.get(type)
		return $e
	}
	const makeGeoUri=(lat: number, lon: number): HTMLAnchorElement=>{
		return makeLink(`${lat}, ${lon}`,`geo:${lat},${lon}`)
	}
	const makeBadge=(title?:string,$leftEdge?:HTMLElement,$rightEdge?:HTMLElement)=>(content:(string|HTMLElement)[],isEmpty=false)=>{
		const $badgeContent=makeElement('span')('content')(...content)
		if (isEmpty) $badgeContent.classList.add('empty')
		const $badge=makeElement('span')('badge')($badgeContent)
		if ($leftEdge) $badge.prepend($leftEdge)
		if ($rightEdge) $badge.append($rightEdge)
		if (title) $badge.title=title
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
			return makeBadge(createdBy)([$a])
		}
		$a.title=createdBy
		$a.classList.add('editor')
		return $a
	}
	const makeEditorBadgeOrIconFromCreatedBy=(createdBy: string)=>{
		if (!createdBy) {
			return makeBadge(`unknown editor`)([`🛠️ ?`])
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
		return makeBadge(createdBy)([`🛠️ ${createdByLead??'?'}`])
	}
	const makeEditorBadgeOrIconFromNoteComment=(comment: string)=>{
		for (const [createdByPrefix,url,editorIcon,noteRegExp] of editorData) {
			if (!noteRegExp) continue
			let match
			if (match=comment.match(noteRegExp)) {
				const [,createdBy]=match
				return makeKnownEditorBadgeOrIcon(createdBy??createdByPrefix,editorIcon,url)
			}
		}
		return null
	}
	const makeCommentRefButton=(uid: number, order: number, commentRef: CommentRef)=>{
		const $button=makeElement('button')('comment-ref')()
		$button.dataset.order=String(order)
		$button.title=`comment ${order+1}`
		writeHueAttributes(colorizer,$button,commentRef.uid)
		$button.innerHTML=makeSvgOfBalloonRef(commentRef.uid!=uid,commentRef.mute,commentRef.action)
		return $button
	}
	const makeAllCommentsBadge=(uid: number, commentRefs: CommentRef[])=>{
		if (commentRefs.length>0) {
			const content:(string|HTMLElement)[]=[]
			for (const [i,commentRef] of commentRefs.entries()) {
				if (i) content.push(` `)
				content.push(makeCommentRefButton(uid,i,commentRef))
			}
			if (commentRefs.length>1) {
				const $leftButton=makeElement('button')('arrow','to-right')()
				$leftButton.title=`earlier comment side`
				const $rightButton=makeElement('button')('arrow','to-right')()
				$rightButton.title=`later comment side`
				return makeBadge(undefined,$leftButton,$rightButton)(content)
			} else {
				return makeBadge()(content)
			}
		} else {
			const $button=makeElement('button')('comment-ref')()
			$button.disabled=true
			$button.innerHTML=makeSvgOfBalloonRef()
			return makeBadge(`no comments`)([$button],true)
		}
	}
	const makeNeighborCommentsBadge=(itemType: 'note'|'changeset', uid: number, order: number, prevCommentRef: CommentRef|undefined, nextCommentRef: CommentRef|undefined)=>{
		if (prevCommentRef || nextCommentRef) {
			const content:(string|HTMLElement)[]=[]
			if (nextCommentRef) {
				content.push(
					makeCommentRefButton(uid,order+1,nextCommentRef),
					` `
				)
			}
			{
				const $currentCommentIcon=makeElement('span')('marker')()
				writeHueAttributes(colorizer,$currentCommentIcon,uid)
				const svg=makeSvgOfComment(itemType)
				const narrowSvg=svg.replace(`width="8"`,`width="4"`)
				$currentCommentIcon.innerHTML=narrowSvg
				content.push($currentCommentIcon)
			}
			if (prevCommentRef) {
				content.push(
					` `,
					makeCommentRefButton(uid,order-1,prevCommentRef)
				)
			}
			const $leftButton=makeElement('button')('arrow','to-left')()
			$leftButton.title=`later comment side`
			const $rightButton=makeElement('button')('arrow','to-left')()
			$rightButton.title=`earlier comment side`
			return makeBadge(undefined,$leftButton,$rightButton)(content)
		} else {
			const $button=makeElement('button')('comment-ref')()
			$button.disabled=true
			$button.innerHTML=makeSvgOfBalloonRef()
			return makeBadge(`no comments`)([$button],true)
		}
	}
	const makeSourceBadge=(source: string|undefined)=>{
		const bracket=(text:string)=>[
			makeElement('span')('delimiter')(`[`),
			text,
			makeElement('span')('delimiter')(`]`)
		]
		if (source) {
			return makeBadge(`source`)(bracket(source))
		} else {
			return makeBadge(`unspecified source`)(bracket(`?`),true)
		}
	}
	const makeChangesBadge=(changesCount: number)=>{
		if (changesCount>0) {
			return makeBadge(`number of changes`)([`📝 ${changesCount}`])
		} else {
			return makeBadge(`no changes`)([`📝 ${changesCount}`],true)
		}
	}
	const makeBboxBadge=(bbox: ChangesetDbRecord['bbox'])=>{
		if (bbox) {
			return makeBadge(`bounding box`)([`⌖ `,makeGeoUri(bbox.minLat,bbox.minLon),` .. `,makeGeoUri(bbox.maxLat,bbox.maxLon)])
		} else {
			return makeBadge(`no bounding box`)([`⌖ none`],true)
		}
	}
	const rewriteWithLinks=(id: number, href: string, apiHref: string)=>{
		const $mainLink=makeLink(String(id),href)
		$mainLink.classList.add('listened')
		const $apiLink=makeLink(`api`,apiHref)
		$apiLink.classList.add('listened')
		$flow.replaceChildren(
			optionalize('id',$mainLink),` `,
			optionalize('api',makeBadge()([$apiLink]))
		)
	}
	const makeProjectBadgeFromComment=(comment: string)=>{
		const badgeContent=makeProjectBadgeContentFromComment(comment)
		if (!badgeContent) return null
		return makeBadge()(badgeContent)
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
		const apiHref=server.api.getUrl(e`user/${item.id}.json`)
		$flow.replaceChildren(
			optionalize('api',makeBadge()([makeLink(`api`,apiHref)])),` `,
			optionalize('status',makeElement('span')()(`account created`))
		)
	} else if (type=='changeset' || type=='changesetClose') {
		date = type=='changesetClose' ? item.closedAt : item.createdAt
		rewriteWithChangesetLinks(item.id)
		$flow.append(
			` `,optionalize('editor',makeEditorBadgeOrIconFromCreatedBy(item.tags.created_by)),
			` `,optionalize('source',makeSourceBadge(item.tags.source))
		)
		if (item.tags?.comment) {
			const $projectBadge=makeProjectBadgeFromComment(item.tags?.comment)
			if ($projectBadge) {
				$flow.append(
					` `,optionalize('project',$projectBadge)
				)
			}
		}
		$flow.append(
			` `,optionalize('changes',makeChangesBadge(item.changes.count)),
			` `,optionalize('position',makeBboxBadge(item.bbox)),
			` `,optionalize('refs',makeAllCommentsBadge(item.uid,item.commentRefs))
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
			` `,optionalize('position',makeBadge(`position`)([`⌖ `,makeGeoUri(item.lat,item.lon)])),
			` `,optionalize('refs',makeAllCommentsBadge(item.uid,item.commentRefs))
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
		let itemType: 'changeset'|'note'
		if (type=='changesetComment') {
			itemType='changeset'
			rewriteWithChangesetLinks(item.itemId)
		} else if (type=='noteComment') {
			itemType='note'
			rewriteWithNoteLinks(item.itemId)
		} else {
			return
		}
		if (item.uid!=item.itemUid) {
			const $senderIcon=makeElement('span')('icon')()
			$senderIcon.classList.add('sender')
			$senderIcon.innerHTML=makeSvgOfUser()+(item.text
				? makeSvgOfCommentTip(1)
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
		if (item.prevCommentRef || item.nextCommentRef) {
			$flow.append(
				` `,optionalize('refs',makeNeighborCommentsBadge(itemType,item.itemUid,item.order,item.prevCommentRef,item.nextCommentRef))
			)
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

function writeNewUserIcon($icon: HTMLElement, id: number|undefined): void {
	$icon.title=id!=null?`user ${id}`:`anonymous user`
	$icon.innerHTML=makeSvgOfNewUser()
}

function writeChangesetIcon($icon: HTMLElement, id: number, isClosed: boolean, isEmpty: boolean, size: number): void {
	if (isClosed) {
		const $button=makeElement('button')('ref')()
		$button.title=`closed changeset ${id}`
		$button.innerHTML=makeSvgOfClosedChangeset(size)
		$icon.append($button)
	} else if (isEmpty) {
		$icon.innerHTML=makeSvgOfEmptyChangeset()
	}
	if (!isClosed) {
		const $checkbox=makeElement('input')()()
		$checkbox.type='checkbox'
		$checkbox.title=`opened changeset ${id}`
		$icon.append($checkbox)
	}
}

function writeNoteIcon($icon: HTMLElement, id: number): void {
	const $anchor=makeElement('a')()()
	$anchor.tabIndex=0
	$anchor.title=`note ${id}`
	$anchor.innerHTML=makeSvgOfNote()
	$icon.append($anchor)
}
