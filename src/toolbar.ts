import {WorkerBroadcastReceiver} from './broadcast-channel'
import {makeElement, makeDiv, makeLabel} from './util/html'
import {strong} from './util/html-shortcuts'

export default function writeToolbar(
	$root: HTMLElement,
	$toolbar: HTMLElement,
	$netDialog: HTMLDialogElement,
	$grid?: HTMLElement,
	host?: string
): void {
	{
		const $message=makeDiv('message')()
		$toolbar.append(
			$message
		)
		if (host) {
			const broadcastReceiver=new WorkerBroadcastReceiver(host)
			broadcastReceiver.onmessage=({data:message})=>{
				$message.replaceChildren(
					strong(message.status),` `,message.text
				)
				if (message.status=='failed') {
					$message.append(
						`: `,strong(message.failedText)
					)
				}
			}
		}
	}
	if (host) {
		const $timeCheckbox=makeElement('input')()()
		$timeCheckbox.type='checkbox'
		$timeCheckbox.oninput=()=>{
			$root.classList.toggle('with-time',$timeCheckbox.checked)
		}
		$toolbar.append(
			makeDiv('input-group')(makeLabel()(
				$timeCheckbox,` Show time`
			))
		)
	}
	if ($grid) {
		const $expandCheckbox=makeElement('input')()()
		$expandCheckbox.type='checkbox'
		$expandCheckbox.oninput=()=>{
			$grid.classList.toggle('with-expanded-items',$expandCheckbox.checked)
		}
		const $showCloseCheckbox=makeElement('input')()()
		$showCloseCheckbox.type='checkbox'
		$showCloseCheckbox.oninput=()=>{
			$grid.classList.toggle('with-changeset-close-items',$showCloseCheckbox.checked)
		}
		$toolbar.append(
			makeDiv('input-group')(makeLabel()(
				$expandCheckbox,` Expand changesets`
			)),
			makeDiv('input-group')(makeLabel()(
				$showCloseCheckbox,` Show changeset close events`
			))
		)
	}
	{
		const $netButton=makeElement('button')()(`Manage servers and logins`)
		$netButton.onclick=()=>{
			$netDialog.showModal()
		}
		$toolbar.append(
			$netButton
		)
	}
}
