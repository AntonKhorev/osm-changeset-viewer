import DragListener from '../drag'

const speedDecayRate=0.003

type Grab = {
	pointerId: number
	startX: number
	startY: number
	currentX: number
	currentY: number
	currentSpeedX: number
	currentSpeedY: number
	currentTime: number
}

export default class MapDragListener extends DragListener<Grab> {
	constructor(
		$target: HTMLElement,
		private start: ()=>boolean,
		private pan: (x:number,y:number)=>void,
		private fling: (speedX:number,speedY:number)=>void
	) {
		super($target)
	}
	beginDrag(ev: PointerEvent) {
		if (!this.start()) return
		const startX=ev.clientX
		const startY=ev.clientY
		const grab:Grab={
			pointerId: ev.pointerId,
			startX,startY,
			currentX: startX,
			currentY: startY,
			currentSpeedX: 0,
			currentSpeedY: 0,
			currentTime: performance.now(),
		}
		return grab
	}
	doDrag(ev: PointerEvent, grab: Grab) {
		const newTime=performance.now()
		const dx=ev.clientX-grab.currentX
		const dy=ev.clientY-grab.currentY
		const dt=newTime-grab.currentTime
		if (dt>0) {
			const speedDecay=Math.exp(-speedDecayRate*dt)
			grab.currentSpeedX=grab.currentSpeedX*speedDecay+dx/dt*(1-speedDecay)
			grab.currentSpeedY=grab.currentSpeedY*speedDecay+dy/dt*(1-speedDecay)
			grab.currentX=ev.clientX
			grab.currentY=ev.clientY
			grab.currentTime=newTime
		}
		this.pan(grab.startX-ev.clientX,grab.startY-ev.clientY)
	}
	endDrag(ev: PointerEvent, grab: Grab) {
		this.fling(-grab.currentSpeedX,-grab.currentSpeedY)
	}
}
