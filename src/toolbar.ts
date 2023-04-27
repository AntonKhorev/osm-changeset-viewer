import type More from './more'
import {WorkerBroadcastReceiver} from './broadcast-channel'
import {makeElement, makeDiv, makeLabel} from './util/html'
import {strong} from './util/html-shortcuts'

export default function writeToolbar(
	$root: HTMLElement,
	$toolbar: HTMLElement,
	$netDialog: HTMLDialogElement,
	$grid?: HTMLElement,
	more?: More,
	host?: string,
	updateTableCallback?: ()=>void
): void {
	{
		const $message=makeDiv('message')()
		$toolbar.append(
			$message
		)
		if (host) {
			const broadcastReceiver=new WorkerBroadcastReceiver(host)
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
						// TODO write fetch log in panel if open
						console.log(host,'<-',message.part.path)
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
	if (host) {
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
	if ($grid) {
		const $checkbox=makeElement('input')()()
		$checkbox.type='checkbox'
		$checkbox.oninput=()=>{
			$grid.classList.toggle('with-closed-changesets',$checkbox.checked)
			updateTableCallback?.()
		}
		const $label=makeLabel()(
			$checkbox,` changeset close events`
		)
		$label.title=`visible only if there's some other event between changeset opening and closing`
		$toolbar.append(
			makeDiv('input-group')($label)
		)
	}
	if ($grid) {
		const $checkbox=makeElement('input')()()
		$checkbox.type='checkbox'
		$checkbox.oninput=()=>{
			$grid.classList.toggle('in-one-column',$checkbox.checked)
			updateTableCallback?.()
		}
		$toolbar.append(
			makeDiv('input-group')(makeLabel()(
				$checkbox,` one column`
			))
		)
	}
	{
		const $netButton=makeElement('button')()(`Servers and logins`)
		$netButton.onclick=()=>{
			$netDialog.showModal()
		}
		$toolbar.append(
			$netButton
		)
	}
}
