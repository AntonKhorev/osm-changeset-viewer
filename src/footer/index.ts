import type {Server} from '../net'
import type Grid from '../grid'
import type More from '../more'
import {WorkerBroadcastReceiver} from '../broadcast-channel'
import {LogPanel,GridSettingsPanel,ActionsPanel,ListPanel} from './panel'
import {makeElement, makeDiv, makeLabel} from '../util/html'
import {strong} from '../util/html-shortcuts'

export default function writeFooter(
	$root: HTMLElement,
	$footer: HTMLElement,
	$netDialog: HTMLDialogElement,
	server?: Server,
	grid?: Grid,
	more?: More,
	toggleMap?: ()=>boolean
): void {
	const $panelButtons:HTMLButtonElement[]=[]	
	const addPanel=([$panel,$button]:[HTMLElement,HTMLButtonElement])=>{
		$footer.append($panel)
		$panelButtons.push($button)
	}
	if (server) addPanel(new LogPanel(server).makePanelAndButton())
	if (grid) addPanel(new GridSettingsPanel(grid).makePanelAndButton())
	if (server && grid) addPanel(new ActionsPanel(server,grid).makePanelAndButton())
	if (server && grid) addPanel(new ListPanel(server,grid).makePanelAndButton())
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
		const addButton=(label: string, title: string, action: ()=>void)=>{
			const $button=makeElement('button')()(label)
			$button.title=title
			$button.onclick=action
			$toolbar.append($button)
			return $button
		}
		addButton(`+`,`Expand selected items`,()=>{ grid.expandSelectedItems() })
		addButton(`−`,`Collapse selected items`,()=>{ grid.collapseSelectedItems() })
		const $stretchAllButton=addButton(`<*>`,`Stretch all items`,()=>{ grid.stretchAllItems() })
		const $shrinkAllButton=addButton(`>*<`,`Shrink all items`,()=>{ grid.shrinkAllItems() })
		;(grid.onExternalControlsStateUpdate=()=>{
			$stretchAllButton.disabled=$shrinkAllButton.disabled=!grid.withTotalColumn
		})()
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
	if (toggleMap) {
		const $button=makeElement('button')()(`Map`)
		$button.setAttribute('aria-expanded','false')
		$button.onclick=()=>{
			$button.setAttribute('aria-expanded',String(toggleMap()))
		}
		$toolbar.append($button)
	}
}
