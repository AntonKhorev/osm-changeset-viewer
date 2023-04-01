import type Net from './net'
import type {HashServerSelector} from './net'
import {makeElement} from './util/html'

export default function makeNetDialog(net: Net<HashServerSelector>): HTMLDialogElement {
	const $helpDialog=makeElement('dialog')('help')()
	const $closeButton=makeElement('button')('close')()
	$closeButton.title=`close dialog`
	$closeButton.innerHTML=`<svg><use href="#close" /></svg>`
	$closeButton.onclick=()=>{
		$helpDialog.close()
	}
	$helpDialog.append(
		$closeButton,
		...net.$sections,
	)
	return $helpDialog
}
