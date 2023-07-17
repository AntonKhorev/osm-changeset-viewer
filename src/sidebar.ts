import MapWidget from './map'
import DragListener from './drag'
import {clamp} from './math'
import {makeElement} from './util/html'

const minSideSize=80
const frMultiplier=100000

type Grab = {
	pointerId: number
	startX: number
	startAsideWidth: number
}

class ResizerDragListener extends DragListener<Grab> {
	protected cursorHovering='col-resize'
	protected cursorGrabbing='col-resize'
	constructor(
		private $root: HTMLElement,
		private $aside: HTMLElement,
		$resizer: HTMLElement
	) {
		super($resizer)
	}
	beginDrag(ev: PointerEvent) {
		return {
			pointerId: ev.pointerId,
			startX: ev.clientX,
			startAsideWidth: this.$aside.clientWidth
		}
	}
	doDrag(ev: PointerEvent, grab: Grab) {
		const dx=clamp(
			minSideSize+grab.startAsideWidth-this.$root.clientWidth,
			ev.clientX-grab.startX,
			grab.startAsideWidth-minSideSize
		)
		let rightSideSizeFr=Math.round(frMultiplier*(grab.startAsideWidth-minSideSize-dx)/(this.$root.clientWidth-2*minSideSize))
		if (!Number.isFinite(rightSideSizeFr)) rightSideSizeFr=minSideSize
		let leftSideSizeFr=frMultiplier-rightSideSizeFr
		this.$root.style.setProperty('--left-side-size',`${leftSideSizeFr}fr`)
		this.$root.style.setProperty('--right-side-size',`${rightSideSizeFr}fr`)
	}
}

export default function writeSidebar(
	$root: HTMLElement,
	$aside: HTMLElement,
	mapWidget: MapWidget
): void {
	$root.style.setProperty('--min-side-size',`${minSideSize}px`)
	const $resizer=makeElement('button')('resizer')()
	new ResizerDragListener($root,$aside,$resizer).install()
	$aside.append($resizer,mapWidget.$widget)
}
