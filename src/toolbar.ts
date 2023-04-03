import {makeElement, makeDiv, makeLabel} from './util/html'

export default function writeToolbar(
	$root: HTMLElement,
	$toolbar: HTMLElement,
	$netDialog: HTMLDialogElement,
	$grid?: HTMLElement
): void {
	{ // TODO hide if invalid host
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
		const $changesetsCheckbox=makeElement('input')()()
		$changesetsCheckbox.type='checkbox'
		$changesetsCheckbox.oninput=()=>{
			$grid.classList.toggle('with-expanded-changesets',$changesetsCheckbox.checked)
		}
		$toolbar.append(
			makeDiv('input-group')(makeLabel()(
				$changesetsCheckbox,` Expand changesets`
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
