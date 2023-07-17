import type {ViewZoomPoint, RenderPoint} from './geo'

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
	startTime: number
	start: ViewZoomPoint
	finishTime: number
	finish: ViewZoomPoint
	transformOrigin: RenderPoint
} | {
	type: 'panning'
	xAxis: AnimationAxis
	yAxis: AnimationAxis
}

export function makeFlingAnimation(
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
