import {WorkerBroadcastReceiver} from './broadcast-channel'
import {makeElement, makeDiv, makeLabel} from './util/html'
import {strong} from './util/html-shortcuts'

export default function writeToolbar(
	$root: HTMLElement,
	$toolbar: HTMLElement,
	$netDialog: HTMLDialogElement,
	$grid?: HTMLElement,
	host?: string,
	closedChangesetsCallback?: ()=>void
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
				$timeCheckbox,` time`
			))
		)
	}
	if ($grid) {
		const $closeEventsCheckbox=makeElement('input')()()
		$closeEventsCheckbox.type='checkbox'
		$closeEventsCheckbox.oninput=()=>{
			$grid.classList.toggle('with-closed-changesets',$closeEventsCheckbox.checked)
			closedChangesetsCallback?.()
		}
		const $closeEventsLabel=makeLabel()(
			$closeEventsCheckbox,` changeset close events`
		)
		$closeEventsLabel.title=`visible only if there's some other event between changeset opening and closing`
		const $oneColumnCheckbox=makeElement('input')()()
		$oneColumnCheckbox.type='checkbox'
		$oneColumnCheckbox.oninput=()=>{
			$grid.classList.toggle('with-expanded-items',$oneColumnCheckbox.checked)
		}
		$toolbar.append(
			makeDiv('input-group')($closeEventsLabel),
			makeDiv('input-group')(makeLabel()(
				$oneColumnCheckbox,` one column`
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
