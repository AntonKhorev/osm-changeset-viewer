import type {Server} from '../net'
import type Grid from '../grid'
import type More from '../more'
import {WorkerBroadcastReceiver} from '../broadcast-channel'
import LogPanel from './panel-log'
import GridSettingsPanel from './panel-grid-settings'
import {makeElement, makeDiv, makeLabel} from '../util/html'
import {strong} from '../util/html-shortcuts'

export default function writeFooter(
	$root: HTMLElement,
	$footer: HTMLElement,
	$netDialog: HTMLDialogElement,
	server?: Server,
	grid?: Grid,
	more?: More
): void {
	const $panelButtons:HTMLButtonElement[]=[]
	if (server) {
		const [$panel,$button]=new LogPanel(server).makePanelAndButton()
		$footer.append($panel)
		$panelButtons.push($button)
	}
	if (grid) {
		const [$panel,$button]=new GridSettingsPanel(grid).makePanelAndButton()
		$footer.append($panel)
		$panelButtons.push($button)
	}
	const $toolbar=makeDiv('toolbar')()
	$footer.append($toolbar)
	{
		const $message=makeDiv('message')()
		$toolbar.append(
			$message
		)
		if (server) {
			const broadcastReceiver=new WorkerBroadcastReceiver(server.host)
			broadcastReceiver.onmessage=({data:message})=>{
				if (message.type!='operation') return
				$message.replaceChildren(
					strong(message.part.status),` `,message.part.text
				)
				if (message.part.status=='failed') {
					$message.append(
						`: `,strong(message.part.failedText)
					)
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
	for (const $button of $panelButtons) {
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
