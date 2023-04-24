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
		$tab: HTMLElement,
		$card: HTMLElement
	}[],
	iActive: number,
	shiftTabCallback: (iShiftTo: number)=>void
) {
	let grab: Grab | undefined
	const {$tab,$card}=elements[iActive]
	const translate=(x:number)=>{
		$tab.style.translate=`${x}px`
		$card.style.translate=`${x}px`
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
		$tab.classList.add('grabbed')
		$card.classList.add('grabbed')
		$grid.classList.add('with-grabbed-tab')
	}
	const cleanup=(grab: Grab)=>{
		for (const {$tab,$card} of elements) {
			$tab.style.removeProperty('translate')
			$card.style.removeProperty('translate')
		}
		$tab.classList.remove('grabbed')
		$card.classList.remove('grabbed')
		$grid.classList.remove('with-grabbed-tab')
		requestAnimationFrame(()=>{
			$tab.style.transition=`none`
			$card.style.transition=`none`
			translate(grab.relativeShiftX)
			requestAnimationFrame(()=>{
				$tab.style.removeProperty('transition')
				$card.style.removeProperty('transition')
				$tab.style.removeProperty('translate')
				$card.style.removeProperty('translate')
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
			elements[iShuffle].$tab.style.translate=`${shuffleX}px`
			elements[iShuffle].$card.style.translate=`${shuffleX}px`
		}
		grab.iShiftTo=iShiftTo
	}
}
