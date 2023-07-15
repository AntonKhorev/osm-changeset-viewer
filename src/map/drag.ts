import DragListener from '../drag'

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

export default class MapDragListener extends DragListener<Grab> {
	constructor(
		$target: HTMLElement,
		private start: ()=>[startPxX:number,startPxY:number]|null,
		private pan: (pxX:number,pxY:number)=>void,
		private fling: (speedPxX:number,speedPxY:number)=>void
	) {
		super($target)
	}
	beginDrag(ev: PointerEvent) {
		const startPxXY=this.start()
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
	}
	doDrag(ev: PointerEvent, grab: Grab) {
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
		this.pan(newPxX,newPxY)
	}
	endDrag(ev: PointerEvent, grab: Grab) {
		this.fling(grab.currentSpeedPxX,grab.currentSpeedPxY)
	}
}
