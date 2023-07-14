import {makeElement, makeDiv} from '../util/html'

export function makeHuePicker() {
	const $stripe=makeElement('span')('hue-picker-stripe')()
	const stripeStops:string[]=[]
	for (let hue=0;hue<=720;hue+=30) {
		stripeStops.push(`hsl(${hue-180} 100% 50%) ${100*hue/720}%`)
	}
	$stripe.style.background=`linear-gradient(to right, ${stripeStops.join(', ')})`
	const $picker=makeDiv('hue-picker')($stripe)
	$picker.tabIndex=0
	return $picker
}

export function updateHuePicker($huePicker: HTMLElement, hue: number) {
	const $stripe=$huePicker.querySelector(':scope > .hue-picker-stripe')
	if ($stripe instanceof HTMLElement) {
		$stripe.style.left=`${-hue*100/360}%`
	}
}
