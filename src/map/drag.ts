import DragListener from '../drag'

const speedDecayRate=0.003

type Grab = {
	pointerId: number
	startViewOffsetX: number
	startViewOffsetY: number
	startX: number
	startY: number
	currentTime: number
	currentX: number
	currentY: number
	currentSpeedX: number
	currentSpeedY: number
}

export default class MapDragListener extends DragListener<Grab> {
	constructor(
		$target: HTMLElement,
		private start: ()=>[startX:number,startY:number]|null,
		private pan: (x:number,y:number)=>void,
		private fling: (speedX:number,speedY:number)=>void
	) {
		super($target)
	}
	beginDrag(ev: PointerEvent) {
		const startXY=this.start()
		if (!startXY) return
		const [startX,startY]=startXY
		const grab:Grab={
			pointerId: ev.pointerId,
			startViewOffsetX: ev.clientX,
			startViewOffsetY: ev.clientY,
			startX,startY,
			currentTime: performance.now(),
			currentX: startX,
			currentY: startY,
			currentSpeedX: 0,
			currentSpeedY: 0,
		}
		return grab
	}
	doDrag(ev: PointerEvent, grab: Grab) {
		const newX=grab.startX-(ev.clientX-grab.startViewOffsetX)
		const newY=grab.startY-(ev.clientY-grab.startViewOffsetY)
		const newTime=performance.now()
		const dx=newX-grab.currentX
		const dy=newY-grab.currentY
		const dt=newTime-grab.currentTime
		const speedDecay=Math.exp(-speedDecayRate*dt)
		grab.currentSpeedX=grab.currentSpeedX*speedDecay+dx/dt*(1-speedDecay)
		grab.currentSpeedY=grab.currentSpeedY*speedDecay+dy/dt*(1-speedDecay)
		grab.currentX=newX
		grab.currentY=newY
		grab.currentTime=newTime
		this.pan(newX,newY)
	}
	endDrag(ev: PointerEvent, grab: Grab) {
		this.fling(grab.currentSpeedX,grab.currentSpeedY)
	}
}
