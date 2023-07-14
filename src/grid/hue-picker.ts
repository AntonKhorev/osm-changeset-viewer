import {makeElement, makeDiv} from '../util/html'

type Grab = {
	pointerId: number
	startX: number
	startValue: number
}

export function makeHuePicker(changeListener: (value:number)=>void) {
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
			$picker.dataset.value=String(newValue)
			slideStripe($stripe,newValue)
			ev.stopPropagation()
			ev.preventDefault()
			changeListener(newValue)
		}
	}
	let grab: Grab | undefined
	const getNewValue=(grab:Grab,pointerX:number)=>limitValue(grab.startValue+(grab.startX-pointerX)*360/$picker.clientWidth)
	$picker.style.touchAction='none'
	$picker.onpointerdown=ev=>{
		if (grab) return
		grab={
			pointerId: ev.pointerId,
			startX: ev.clientX,
			startValue: readValueFromString($picker.dataset.value??'')
		}
		$picker.setPointerCapture(ev.pointerId)
		$picker.classList.add('grabbed')
	}
	$picker.onpointerup=$picker.onpointercancel=ev=>{
		if (!grab || grab.pointerId!=ev.pointerId) return
		const newValue=getNewValue(grab,ev.clientX)
		$picker.dataset.value=String(newValue)
		slideStripe($stripe,newValue)
		grab=undefined
		$picker.classList.remove('grabbed')
		changeListener(newValue)
	}
	$picker.onpointermove=ev=>{
		if (!grab || grab.pointerId!=ev.pointerId) return
		const newValue=getNewValue(grab,ev.clientX)
		slideStripe($stripe,newValue)
	}
	return $picker
}

export function updateHuePicker($picker: HTMLElement, value: number): void {
	$picker.dataset.value=String(value)
	const $stripe=$picker.querySelector(':scope > .hue-picker-stripe')
	if ($stripe instanceof HTMLElement) {
		slideStripe($stripe,value)
	}
}

function slideStripe($stripe: HTMLElement, value: number): void {
	$stripe.style.left=`${-value*100/360}%`
}

function readValueFromString(s: string): number {
	const v=Number(s)
	if (!Number.isFinite(v)) return 0
	return limitValue(v)
}

function limitValue(v: number): number {
	return mod(Math.round(v),360)
}

function mod(n: number, d: number): number {
	return (n%d+d)%d
}
