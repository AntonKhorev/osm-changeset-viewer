import installDragListeners from '../drag'

const speedDecayRate=0.003

export default function installMapDragListeners(
	$mapView: HTMLElement,
	start: ()=>[startPxX:number,startPxY:number]|null,
	pan: (pxX:number,pxY:number)=>void,
	fling: (speedPxX:number,speedPxY:number)=>void
): void {
	installDragListeners($mapView,ev=>{
		const startPxXY=start()
		if (!startPxXY) return
		const [startPxX,startPxY]=startPxXY
		const grab={
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
		return grab
	},(ev,grab)=>{
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
	},(ev,grab)=>{
		fling(grab.currentSpeedPxX,grab.currentSpeedPxY)
	})
}
