import type {Server} from './net'
import type Grid from './grid'
import type More from './more'
import {WorkerBroadcastReceiver} from './broadcast-channel'
import {makeElement, makeDiv, makeLabel, makeLink} from './util/html'
import {ul,li,strong} from './util/html-shortcuts'

export default function writeFooter(
	$root: HTMLElement,
	$footer: HTMLElement,
	$netDialog: HTMLDialogElement,
	server?: Server,
	grid?: Grid,
	more?: More
): void {
	const $logList=ul()
	const $logClearButton=makeElement('button')()(`clear`)
	$logClearButton.onclick=()=>{
		$logList.replaceChildren()
	}
	const $log=makeSection('log')
	$log.append(
		makeElement('h2')()(`Fetches`),
		makeDiv('controls')($logClearButton),
		$logList
	)
	const $toolbar=makeDiv('toolbar')()
	$footer.append($log,$toolbar)
	{
		const $message=makeDiv('message')()
		$toolbar.append(
			$message
		)
		if (server) {
			const broadcastReceiver=new WorkerBroadcastReceiver(server.host)
			broadcastReceiver.onmessage=({data:message})=>{
				if (message.type=='operation') {
					$message.replaceChildren(
						strong(message.part.status),` `,message.part.text
					)
					if (message.part.status=='failed') {
						$message.append(
							`: `,strong(message.part.failedText)
						)
					}
				} else if (message.type=='log') {
					if (message.part.type=='fetch') {
						const atBottom=$log.offsetHeight+$log.scrollTop>=$log.scrollHeight-16
						const path=message.part.path
						let docHref: string|undefined
						if (path.startsWith(`changesets.json`)) {
							docHref=`https://wiki.openstreetmap.org/wiki/API_v0.6#Query:_GET_/api/0.6/changesets`
						} else if (path.startsWith(`notes/search.json`)) {
							docHref=`https://wiki.openstreetmap.org/wiki/API_v0.6#Search_for_notes:_GET_/api/0.6/notes/search`
						} else if (path.match(/^user\/\d+\.json/)) {
							docHref=`https://wiki.openstreetmap.org/wiki/API_v0.6#Details_of_a_user:_GET_/api/0.6/user/#id`
						}
						const href=server.api.getUrl(path)
						const $li=li(
							makeLink(href,href)
						)
						if (docHref) {
							$li.append(
								` [`,makeLink(`?`,docHref),`]`
							)
						}
						$logList.append($li)
						if (atBottom) {
							$li.scrollIntoView()
						}
					}
				}
			}
		}
	}
	if (more) {
		const $checkbox=makeElement('input')()()
		$checkbox.type='checkbox'
		$checkbox.oninput=()=>{
			more.autoLoad=$checkbox.checked
		}
		$toolbar.append(
			makeDiv('input-group')(makeLabel()(
				$checkbox,` auto load more`
			))
		)
	}
	if (server) {
		const $checkbox=makeElement('input')()()
		$checkbox.type='checkbox'
		$checkbox.oninput=()=>{
			$root.classList.toggle('with-time',$checkbox.checked)
		}
		$toolbar.append(
			makeDiv('input-group')(makeLabel()(
				$checkbox,` time`
			))
		)
	}
	if (grid) {
		const addGridCheckbox=(
			setOption: (value:boolean)=>void,
			label: string, labelTitle?: string
		)=>{
			const $checkbox=makeElement('input')()()
			$checkbox.type='checkbox'
			$checkbox.oninput=()=>{
				setOption($checkbox.checked)
				grid.updateTableAccordingToSettings()
			}
			const $label=makeLabel()(
				$checkbox,` `,label
			)
			if (labelTitle) $label.title=labelTitle
			$toolbar.append(
				makeDiv('input-group')($label)
			)
		}
		addGridCheckbox(
			value=>grid.withCompactIds=value,
			`compact ids in collections`
		)
		addGridCheckbox(
			value=>grid.withClosedChangesets=value,
			`changeset close events`,`visible only if there's some other event between changeset opening and closing`
		)
		addGridCheckbox(
			value=>grid.inOneColumn=value,
			`one column`
		)
	}
	if (grid) {
		const $checkbox=makeElement('input')()()
		$checkbox.type='checkbox'
		$checkbox.oninput=()=>{
			grid.addExpandedItems=$checkbox.checked
		}
		$toolbar.append(
			makeDiv('input-group')(makeLabel()(
				$checkbox,` add expanded items`
			))
		)
	}
	if (grid) {
		const $button=makeElement('button')()(`+`)
		$button.title=`Expand selected items`
		$button.onclick=()=>{
			grid.expandSelectedItems()
		}
		$toolbar.append($button)
	}
	if (grid) {
		const $button=makeElement('button')()(`−`)
		$button.title=`Collapse selected items`
		$button.onclick=()=>{
			grid.collapseSelectedItems()
		}
		$toolbar.append($button)
	}
	if (server) {
		const $button=makeElement('button')()(`Fetch log`)
		$button.onclick=()=>{
			$footer.classList.toggle('with-log')
		}
		$toolbar.append($button)
	}
	{
		const $button=makeElement('button')()(`Servers and logins`)
		$button.onclick=()=>{
			$netDialog.showModal()
		}
		$toolbar.append($button)
	}
}

function makeSection(className: string): HTMLElement {
	const minHeight=64
	const $resizer=makeElement('button')('resizer')()
	const $section=makeElement('section')(className)(
		$resizer
	)
	let grab: {
		pointerId: number
		startY: number
		startHeight: number
	} | undefined
	$resizer.onpointerdown=ev=>{
		if (grab) return
		grab={
			pointerId: ev.pointerId,
			startY: ev.clientY,
			startHeight: $section.clientHeight
		}
		$resizer.setPointerCapture(ev.pointerId)
	}
	$resizer.onpointerup=ev=>{
		grab=undefined
	}
	$resizer.onpointermove=ev=>{
		if (!grab || grab.pointerId!=ev.pointerId) return
		const newHeight=Math.max(
			minHeight,
			grab.startHeight-(ev.clientY-grab.startY)
		)
		$section.style.height=`${newHeight}px`
	}
	return $section
}
