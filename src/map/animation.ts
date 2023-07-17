import type {ViewTimeZoomPoint, ViewPoint, RenderPoint} from './geo'

const curveParameter=0.002 // [px/ms^2]
const dragStepThreshold=32 // [px]

export default class AnimationAxis {
	constructor(
		public startPosition: number, // [px]
		public decayOffset: number,
		public decayDistance: number,
		public startTime: number,
		public decayStartTime: number,
		public decayDuration: number
	) {}
	transitionToDecay(time: number): void {
		if (time<this.decayStartTime) {
			this.decayStartTime=time
		}
	}
	isLinear(time: number): boolean {
		return time<this.decayStartTime
	}
	isEnded(time: number): boolean {
		return time>=this.decayStartTime+this.decayDuration
	}
	getPosition(time: number): number {
		let linearTime=time-this.startTime
		if (time>this.decayStartTime) {
			linearTime=this.decayStartTime-this.startTime
		}
		let decayRemainingTime=this.decayDuration
		if (time>this.decayStartTime) {
			decayRemainingTime-=(time-this.decayStartTime)
		}
		if (decayRemainingTime<0) {
			decayRemainingTime=0
		}
		const axisDirection=this.decayOffset/this.decayDistance
		return (
			this.startPosition +
			axisDirection*linearTime +
			this.decayOffset-axisDirection*curveParameter*decayRemainingTime**2
		)
	}
}

export type Animation = {
	type: 'stopped'
} | {
	type: 'zooming'
	start: ViewTimeZoomPoint
	finish: ViewTimeZoomPoint
	transformOrigin: RenderPoint
} | {
	type: 'panning'
	dragStart: ViewPoint
	xAxis: AnimationAxis
	yAxis: AnimationAxis
} | {
	type: 'dragging'
	start: ViewPoint
}

export function makeFlingAnimation(
	dragStart: ViewPoint,
	startTime: number,
	startX: number, startY: number,
	speedX: number, speedY: number
): Animation {
	const speed=Math.hypot(speedX,speedY)
	const decayDuration=speed/(2*curveParameter)
	const dp=curveParameter*decayDuration**2
	if (dp<dragStepThreshold) {
		return {type:'stopped'}
	} else {
		const dx=dp*speedX/speed
		const dy=dp*speedY/speed
		return {
			type: 'panning',
			dragStart,
			xAxis: new AnimationAxis(
				startX,dx,dp,
				startTime,startTime,decayDuration
			),
			yAxis: new AnimationAxis(
				startY,dy,dp,
				startTime,startTime,decayDuration
			),
		}
	}
}
