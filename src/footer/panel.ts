import {makeElement, makeDiv} from '../util/html'

export default abstract class Panel {
	protected abstract readonly className: string
	protected abstract readonly buttonLabel: string
	makePanelAndButton(): [$panel: HTMLElement, $button: HTMLButtonElement] {
		const minHeight=32
		const $resizer=makeElement('button')('resizer')()
		const $section=makeElement('section')()()
		const $panel=makeDiv('panel',this.className)($resizer,$section)
		$panel.hidden=true
		let grab: {
			pointerId: number
			startY: number
			startHeight: number
		} | undefined
		$resizer.onpointerdown=ev=>{
			if (grab) return
			grab={
				pointerId: ev.pointerId,
				startY: ev.clientY,
				startHeight: $panel.clientHeight
			}
			$resizer.setPointerCapture(ev.pointerId)
		}
		$resizer.onpointerup=ev=>{
			grab=undefined
		}
		$resizer.onpointermove=ev=>{
			if (!grab || grab.pointerId!=ev.pointerId) return
			const newHeight=Math.max(
				minHeight,
				grab.startHeight-(ev.clientY-grab.startY)
			)
			$panel.style.height=`${newHeight}px`
		}
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
