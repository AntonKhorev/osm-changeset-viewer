const speedDecayRate=0.003

type Grab = {
	pointerId: number
	startViewPxOffsetX: number
	startViewPxOffsetY: number
	startPxX: number
	startPxY: number
	currentTime: number
	currentPxX: number
	currentPxY: number
	currentSpeedPxX: number
	currentSpeedPxY: number
}

export default function installDragListeners(
	$mapView: HTMLElement,
	start: ()=>[startPxX:number,startPxY:number]|null,
	pan: (pxX:number,pxY:number)=>void,
	fling: (speedPxX:number,speedPxY:number)=>void
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
			startPxX,startPxY,
			currentTime: performance.now(),
			currentPxX: startPxX,
			currentPxY: startPxY,
			currentSpeedPxX: 0,
			currentSpeedPxY: 0,
		}
		$mapView.setPointerCapture(ev.pointerId)
		$mapView.classList.add('grabbed')
	}
	$mapView.onpointerup=$mapView.onpointercancel=ev=>{
		if (!grab || grab.pointerId!=ev.pointerId) return
		fling(grab.currentSpeedPxX,grab.currentSpeedPxY)
		grab=undefined
		$mapView.classList.remove('grabbed')
	}
	$mapView.onpointermove=ev=>{
		if (!grab || grab.pointerId!=ev.pointerId) return
		const newPxX=grab.startPxX-(ev.clientX-grab.startViewPxOffsetX)
		const newPxY=grab.startPxY-(ev.clientY-grab.startViewPxOffsetY)
		const newTime=performance.now()
		const dx=newPxX-grab.currentPxX
		const dy=newPxY-grab.currentPxY
		const dt=newTime-grab.currentTime
		const speedDecay=Math.exp(-speedDecayRate*dt)
		grab.currentSpeedPxX=grab.currentSpeedPxX*speedDecay+dx/dt*(1-speedDecay)
		grab.currentSpeedPxY=grab.currentSpeedPxY*speedDecay+dy/dt*(1-speedDecay)
		grab.currentPxX=newPxX
		grab.currentPxY=newPxY
		grab.currentTime=newTime
		pan(newPxX,newPxY)
	}
}
