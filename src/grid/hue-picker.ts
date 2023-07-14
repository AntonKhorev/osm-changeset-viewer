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
	$picker.dataset.value=String(0)
	$picker.onkeydown=ev=>{
		const value=readValueFromString($picker.dataset.value??'')
		let newValue:number|undefined
		if (ev.key=='ArrowLeft') {
			newValue=mod(value-10,360)
		} else if (ev.key=='ArrowRight') {
			newValue=mod(value+10,360)
		}
		if (newValue!=null) {
			updateHuePicker($picker,newValue)
			ev.stopPropagation()
			ev.preventDefault()
		}
	}
	return $picker
}

export function updateHuePicker($picker: HTMLElement, value: number) {
	$picker.dataset.value=String(value)
	const $stripe=$picker.querySelector(':scope > .hue-picker-stripe')
	if ($stripe instanceof HTMLElement) {
		$stripe.style.left=`${-value*100/360}%`
	}
}

function readValueFromString(s: string): number {
	const v=Number(s)
	if (!Number.isFinite(v)) return 0
	return mod(Math.round(v),360)
}

function mod(n: number, d: number): number {
	return (n%d+d)%d
}
