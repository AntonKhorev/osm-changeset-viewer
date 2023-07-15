import DragListener from '../drag'

type Grab = {
	pointerId: number
	startX: number
	iShiftTo: number
	relativeShiftX: number
}

export default class TabDragListener extends DragListener<Grab> {
	constructor(
		private $gridHead: HTMLTableSectionElement,
		private gridHeadCells: readonly {
			$tabCell: HTMLTableCellElement
			$cardCell: HTMLTableCellElement
			$selectorCell: HTMLTableCellElement
		}[],
		$tab: HTMLElement,
		private iActive: number,
		private shiftTabCallback: (iShiftTo: number)=>void
	) {
		super($tab)
	}
	install(): void {
		const activeCells=this.gridHeadCells[this.iActive]
		activeCells.$tabCell.ontransitionend=
		activeCells.$cardCell.ontransitionend=
		activeCells.$selectorCell.ontransitionend=ev=>{
			const $cell=ev.currentTarget
			if (!($cell instanceof HTMLElement)) return
			$cell.classList.remove('settling')
		}
		super.install()
	}
	beginDrag(ev: PointerEvent) {
		if (ev.target instanceof Element && ev.target.closest('button')) return
		this.toggleCellClass('grabbed',true)
		this.$gridHead.classList.add('with-grabbed-tab')
		return {
			pointerId: ev.pointerId,
			startX: ev.clientX,
			iShiftTo: this.iActive,
			relativeShiftX: 0
		}
	}
	doDrag(ev: PointerEvent, grab: Grab) {
		const cellStartX=this.gridHeadCells[this.iActive].$tabCell.offsetLeft
		const minOffsetX=this.gridHeadCells[0].$tabCell.offsetLeft-cellStartX
		const maxOffsetX=this.gridHeadCells[this.gridHeadCells.length-1].$tabCell.offsetLeft-cellStartX
		const offsetX=Math.max(
			minOffsetX,
		Math.min(
			maxOffsetX,
			ev.clientX-grab.startX
		))
		this.translate(offsetX)
		const cellOffsetX=cellStartX+offsetX
		let iShiftTo=0
		for (;iShiftTo<this.gridHeadCells.length;iShiftTo++) {
			const $shiftToCell=this.gridHeadCells[iShiftTo].$tabCell
			grab.relativeShiftX=cellOffsetX-$shiftToCell.offsetLeft
			if (cellOffsetX<$shiftToCell.offsetLeft+$shiftToCell.offsetWidth/2) {
				break
			}
		}
		for (let iShuffle=0;iShuffle<this.gridHeadCells.length;iShuffle++) {
			if (iShuffle==this.iActive) continue
			let shuffleX=0
			if (iShuffle>=iShiftTo && iShuffle<this.iActive) {
				shuffleX=this.gridHeadCells[iShuffle+1].$tabCell.offsetLeft-this.gridHeadCells[iShuffle].$tabCell.offsetLeft
			}
			if (iShuffle>this.iActive && iShuffle<=iShiftTo) {
				shuffleX=this.gridHeadCells[iShuffle-1].$tabCell.offsetLeft-this.gridHeadCells[iShuffle].$tabCell.offsetLeft
			}
			this.translate(shuffleX,iShuffle)
		}
		grab.iShiftTo=iShiftTo
	}
	applyDrag(ev: PointerEvent, grab: Grab) {
		if (grab.iShiftTo!=this.iActive) this.shiftTabCallback(grab.iShiftTo)
	}
	endDrag(ev: PointerEvent, grab: Grab) {
		for (const i of this.gridHeadCells.keys()) {
			this.translate(0,i)
		}
		this.toggleCellClass('grabbed',false)
		this.$gridHead.classList.remove('with-grabbed-tab')
		if (!grab.relativeShiftX) return
		requestAnimationFrame(()=>{
			this.translate(grab.relativeShiftX)
			requestAnimationFrame(()=>{
				this.toggleCellClass('settling',true)
				this.translate(0)
			})
		})
	}
	private translate(x: number, i=this.iActive): void {
		const {$tabCell,$cardCell,$selectorCell}=this.gridHeadCells[i]
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
	private toggleCellClass(className: string, on: boolean): void {
		const activeCells=this.gridHeadCells[this.iActive]
		activeCells.$tabCell.classList.toggle(className,on)
		activeCells.$cardCell.classList.toggle(className,on)
		activeCells.$selectorCell.classList.toggle(className,on)
	}
}
