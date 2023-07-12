type Grab = {
	pointerId: number
	startX: number
	iShiftTo: number
	relativeShiftX: number
}

export default function installTabDragListeners(
	$gridHead: HTMLTableSectionElement,
	gridHeadCells: readonly {
		$tabCell: HTMLTableCellElement
		$cardCell: HTMLTableCellElement
		$selectorCell: HTMLTableCellElement
	}[],
	$tab: HTMLElement,
	iActive: number,
	shiftTabCallback: (iShiftTo: number)=>void
) {
	let grab: Grab | undefined
	const {
		$tabCell: $activeTabCell,
		$cardCell: $activeCardCell,
		$selectorCell: $activeSelectorCell
	}=gridHeadCells[iActive]
	const toggleCellClass=(className:string,on:boolean)=>{
		$activeTabCell.classList.toggle(className,on)
		$activeCardCell.classList.toggle(className,on)
		$activeSelectorCell.classList.toggle(className,on)
	}
	const translate=(x:number,i:number=iActive)=>{
		const {$tabCell,$cardCell,$selectorCell}=gridHeadCells[i]
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
	$activeTabCell.ontransitionend=()=>{
		$activeTabCell.classList.remove('settling')
	}
	$activeCardCell.ontransitionend=()=>{
		$activeCardCell.classList.remove('settling')
	}
	$activeSelectorCell.ontransitionend=()=>{
		$activeSelectorCell.classList.remove('settling')
	}
	$tab.style.touchAction='none'
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
		for (const i of gridHeadCells.keys()) {
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
		const cellStartX=gridHeadCells[iActive].$tabCell.offsetLeft
		const minOffsetX=gridHeadCells[0].$tabCell.offsetLeft-cellStartX
		const maxOffsetX=gridHeadCells[gridHeadCells.length-1].$tabCell.offsetLeft-cellStartX
		const offsetX=Math.max(
			minOffsetX,
		Math.min(
			maxOffsetX,
			ev.clientX-grab.startX
		))
		translate(offsetX)
		const cellOffsetX=cellStartX+offsetX
		let iShiftTo=0
		for (;iShiftTo<gridHeadCells.length;iShiftTo++) {
			const $shiftToCell=gridHeadCells[iShiftTo].$tabCell
			grab.relativeShiftX=cellOffsetX-$shiftToCell.offsetLeft
			if (cellOffsetX<$shiftToCell.offsetLeft+$shiftToCell.offsetWidth/2) {
				break
			}
		}
		for (let iShuffle=0;iShuffle<gridHeadCells.length;iShuffle++) {
			if (iShuffle==iActive) continue
			let shuffleX=0
			if (iShuffle>=iShiftTo && iShuffle<iActive) {
				shuffleX=gridHeadCells[iShuffle+1].$tabCell.offsetLeft-gridHeadCells[iShuffle].$tabCell.offsetLeft
			}
			if (iShuffle>iActive && iShuffle<=iShiftTo) {
				shuffleX=gridHeadCells[iShuffle-1].$tabCell.offsetLeft-gridHeadCells[iShuffle].$tabCell.offsetLeft
			}
			translate(shuffleX,iShuffle)
		}
		grab.iShiftTo=iShiftTo
	}
}
