import DragListener from '../../drag'
import {makeElement, makeDiv} from '../../util/html'

const minHeight=32

type Grab = {
	pointerId: number
	startY: number
	startHeight: number
}

class ResizerDragListener extends DragListener<Grab> {
	protected cursorHovering='row-resize'
	protected cursorGrabbing='row-resize'
	constructor(
		$resizer: HTMLElement,
		private $panel: HTMLElement
	) {
		super($resizer)
	}
	beginDrag(ev: PointerEvent) {
		return {
			pointerId: ev.pointerId,
			startY: ev.clientY,
			startHeight: this.$panel.clientHeight
		}
	}
	doDrag(ev: PointerEvent, grab: Grab) {
		const newHeight=Math.max(
			minHeight,
			grab.startHeight-(ev.clientY-grab.startY)
		)
		this.$panel.style.height=`${newHeight}px`
	}
}

export default abstract class Panel {
	protected abstract readonly className: string
	protected abstract readonly buttonLabel: string
	makePanelAndButton(): [$panel: HTMLElement, $button: HTMLButtonElement] {
		const $resizer=makeElement('button')('resizer')()
		const $section=makeElement('section')()()
		const $panel=makeDiv('panel',this.className)($resizer,$section)
		$panel.hidden=true
		new ResizerDragListener($resizer,$panel).install()
		const $button=makeElement('button')()(this.buttonLabel)
		$button.setAttribute('aria-expanded',String(!$panel.hidden))
		$button.onclick=()=>{
			$panel.hidden=!$panel.hidden
			$button.setAttribute('aria-expanded',String(!$panel.hidden))
		}
		this.writeSection($section)
		return [$panel,$button]
	}
	abstract writeSection($section: HTMLElement): void
}
