import {makeElement, makeDiv, makeLabel} from './util/html'

export default function writeToolbar(
	$root: HTMLElement,
	$toolbar: HTMLElement,
	$netDialog: HTMLDialogElement
): void {
	const $timeCheckbox=makeElement('input')()()
	$timeCheckbox.type='checkbox'
	const $netButton=makeElement('button')()(`Manage servers and logins`)
	$netButton.onclick=()=>{
		$netDialog.showModal()
	}
	$timeCheckbox.oninput=()=>{
		$root.classList.toggle('with-time')
	}
	$toolbar.append(
		makeDiv('input-group')(makeLabel()(
			$timeCheckbox,` Show time`
		)),
		$netButton
	)
}
