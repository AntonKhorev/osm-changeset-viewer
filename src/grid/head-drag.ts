type Grab = {
	pointerId: number
	startX: number
	iShiftTo: number
	relativeShiftX: number
}

export default function installTabDragListeners(
	$gridHead: HTMLTableSectionElement,
	elements: readonly {
		$tabCell: HTMLTableCellElement,
		$cardCell: HTMLTableCellElement,
		$selectorCell: HTMLTableCellElement,
		$tab: HTMLElement,
		$card: HTMLElement,
		$selector: HTMLElement
	}[],
	iActive: number,
	shiftTabCallback: (iShiftTo: number)=>void
) {
	let grab: Grab | undefined
	const {
		$tabCell,$tab,
		$cardCell,$card,
		$selectorCell,$selector
	}=elements[iActive]
	const toggleCellClass=(className:string,on:boolean)=>{
		$tabCell.classList.toggle(className,on)
		$cardCell.classList.toggle(className,on)
		$selectorCell.classList.toggle(className,on)
	}
	const translate=(x:number,i:number=iActive)=>{
		const {$tabCell,$cardCell,$selectorCell}=elements[i]
		if (x) {
			$tabCell.style.translate=`${x}px`
			$cardCell.style.translate=`${x}px`
			$selectorCell.style.translate=`${x}px`
		} else {
			$tabCell.style.removeProperty('translate')
			$cardCell.style.removeProperty('translate')
			$selectorCell.style.removeProperty('translate')
		}
	}
	$tabCell.ontransitionend=()=>{
		$tabCell.classList.remove('settling')
	}
	$cardCell.ontransitionend=()=>{
		$cardCell.classList.remove('settling')
	}
	$selectorCell.ontransitionend=()=>{
		$selectorCell.classList.remove('settling')
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
		toggleCellClass('grabbed',true)
		$gridHead.classList.add('with-grabbed-tab')
	}
	const cleanup=(grab: Grab)=>{
		for (const i of elements.keys()) {
			translate(0,i)
		}
		toggleCellClass('grabbed',false)
		$gridHead.classList.remove('with-grabbed-tab')
		if (!grab.relativeShiftX) return
		requestAnimationFrame(()=>{
			translate(grab.relativeShiftX)
			requestAnimationFrame(()=>{
				toggleCellClass('settling',true)
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
