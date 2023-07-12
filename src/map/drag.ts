type Grab = {
	pointerId: number
	startViewPxOffsetX: number
	startViewPxOffsetY: number
	startPxX: number
	startPxY: number
}

export default function installDragListeners(
	$mapView: HTMLElement,
	start: ()=>[startPxX:number,startPxY:number]|null,
	pan: (pxX:number,pxY:number)=>void
): void {
	let grab: Grab | undefined
	$mapView.style.touchAction='none'
	$mapView.onpointerdown=ev=>{
		if (grab) return
		const startPxXY=start()
		if (!startPxXY) return
		const [startPxX,startPxY]=startPxXY
		grab={
			pointerId: ev.pointerId,
			startViewPxOffsetX: ev.clientX,
			startViewPxOffsetY: ev.clientY,
			startPxX,startPxY
		}
		$mapView.setPointerCapture(ev.pointerId)
		$mapView.classList.add('grabbed')
	}
	$mapView.onpointerup=$mapView.onpointercancel=ev=>{
		if (!grab || grab.pointerId!=ev.pointerId) return
		grab=undefined
		$mapView.classList.remove('grabbed')
	}
	$mapView.onpointermove=ev=>{
		if (!grab || grab.pointerId!=ev.pointerId) return
		pan(
			grab.startPxX-(ev.clientX-grab.startViewPxOffsetX),
			grab.startPxY-(ev.clientY-grab.startViewPxOffsetY)
		)
	}
}
