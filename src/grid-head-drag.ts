type Grab = {
	pointerId: number
	startX: number
	iShiftTo: number
	relativeShiftX: number
}

export default function installTabDragListeners(
	$grid: HTMLTableElement,
	elements: readonly {
		$tabCell: HTMLTableCellElement,
		$cardCell: HTMLTableCellElement,
		$tab: HTMLElement,
		$card: HTMLElement
	}[],
	iActive: number,
	shiftTabCallback: (iShiftTo: number)=>void
) {
	let grab: Grab | undefined
	const {$tabCell,$cardCell,$tab,$card}=elements[iActive]
	const translate=(x:number,i:number=iActive)=>{
		const {$tab,$card}=elements[i]
		if (x) {
			$tab.style.translate=`${x}px`
			$card.style.translate=`${x}px`
		} else {
			$tab.style.removeProperty('translate')
			$card.style.removeProperty('translate')
		}
	}
	$tab.ontransitionend=()=>{
		$tabCell.classList.remove('settling')
	}
	$card.ontransitionend=()=>{
		$cardCell.classList.remove('settling')
	}
	$tab.onpointerdown=ev=>{
		if (grab) return
		if (ev.target instanceof Element && ev.target.closest('button')) return
		grab={
			pointerId: ev.pointerId,
			startX: ev.clientX,
			iShiftTo: iActive,
			relativeShiftX: 0
		}
		$tab.setPointerCapture(ev.pointerId)
		$tabCell.classList.add('grabbed')
		$cardCell.classList.add('grabbed')
		$grid.classList.add('with-grabbed-tab')
	}
	const cleanup=(grab: Grab)=>{
		for (const i of elements.keys()) {
			translate(0,i)
		}
		$tabCell.classList.remove('grabbed')
		$cardCell.classList.remove('grabbed')
		$grid.classList.remove('with-grabbed-tab')
		requestAnimationFrame(()=>{
			translate(grab.relativeShiftX)
			requestAnimationFrame(()=>{
				$tabCell.classList.add('settling')
				$cardCell.classList.add('settling')
				translate(0)
			})
		})
	}
	$tab.onpointerup=ev=>{
		if (!grab || grab.pointerId!=ev.pointerId) return
		const iShiftTo=grab.iShiftTo
		cleanup(grab)
		grab=undefined
		if (iShiftTo!=iActive) shiftTabCallback(iShiftTo)
	}
	$tab.onpointercancel=ev=>{
		if (!grab || grab.pointerId!=ev.pointerId) return
		cleanup(grab)
		grab=undefined
	}
	$tab.onpointermove=ev=>{
		if (!grab || grab.pointerId!=ev.pointerId) return
		const cellStartX=elements[iActive].$tabCell.offsetLeft
		const minOffsetX=elements[0].$tabCell.offsetLeft-cellStartX
		const maxOffsetX=elements[elements.length-1].$tabCell.offsetLeft-cellStartX
		const offsetX=Math.max(
			minOffsetX,
		Math.min(
			maxOffsetX,
			ev.clientX-grab.startX
		))
		translate(offsetX)
		const cellOffsetX=cellStartX+offsetX
		let iShiftTo=0
		for (;iShiftTo<elements.length;iShiftTo++) {
			const $shiftToCell=elements[iShiftTo].$tabCell
			grab.relativeShiftX=cellOffsetX-$shiftToCell.offsetLeft
			if (cellOffsetX<$shiftToCell.offsetLeft+$shiftToCell.offsetWidth/2) {
				break
			}
		}
		for (let iShuffle=0;iShuffle<elements.length;iShuffle++) {
			if (iShuffle==iActive) continue
			let shuffleX=0
			if (iShuffle>=iShiftTo && iShuffle<iActive) {
				shuffleX=elements[iShuffle+1].$tabCell.offsetLeft-elements[iShuffle].$tabCell.offsetLeft
			}
			if (iShuffle>iActive && iShuffle<=iShiftTo) {
				shuffleX=elements[iShuffle-1].$tabCell.offsetLeft-elements[iShuffle].$tabCell.offsetLeft
			}
			translate(shuffleX,iShuffle)
		}
		grab.iShiftTo=iShiftTo
	}
}
