import type {ItemSequencePoint} from './info'
import {isItem, readItemSequencePoint, isGreaterElementSequencePoint} from './info'
import {makeDiv} from '../util/html'
import {moveInArray} from '../util/types'

export default class ItemRow {
	constructor(
		public $row: HTMLTableRowElement
	) {}
	isEmpty(): boolean {
		return !this.$row.querySelector(':scope > td > * > .item')
	}
	get isStretched(): boolean {
		const $stretchCell=this.$row.cells[0]
		return $stretchCell.colSpan>1
	}
	getBoundarySequencePoints(): [
		greaterPoint: ItemSequencePoint|null,
		lesserPoint: ItemSequencePoint|null
	] {
		let greaterPoint: ItemSequencePoint|null = null
		let lesserPoint: ItemSequencePoint|null = null
		for (const $cell of this.$row.cells) {
			const [$container]=$cell.children
			if (!($container instanceof HTMLElement)) continue
			for (const $item of $container.children) {
				if (!isItem($item)) continue
				const point=readItemSequencePoint($item)
				if (!point) continue
				if (!greaterPoint || isGreaterElementSequencePoint(point,greaterPoint)) {
					greaterPoint=point
				}
				if (!lesserPoint || isGreaterElementSequencePoint(lesserPoint,point)) {
					lesserPoint=point
				}
			}
		}
		return [greaterPoint,lesserPoint]
	}
	*getItemSequence(): Iterable<[point: ItemSequencePoint, items: [iColumn: number, $item: HTMLElement][]]> {
		const nRawColumns=this.$row.cells.length
		if (nRawColumns==0) return
		const iRawColumnPositions=Array<number>(nRawColumns).fill(0)
		while (true) {
			let point: ItemSequencePoint|undefined
			let rawItems: [iRawColumn: number, $item: HTMLElement][] = []
			for (const [iRawColumn,$cell] of [...this.$row.cells].entries()) {
				const [$container]=$cell.children
				if (!($container instanceof HTMLElement)) continue
				let $item: Element|undefined
				let columnPoint: ItemSequencePoint|null = null
				for (;iRawColumnPositions[iRawColumn]<$container.children.length;iRawColumnPositions[iRawColumn]++) {
					$item=$container.children[iRawColumnPositions[iRawColumn]]
					if (!isItem($item)) continue
					columnPoint=readItemSequencePoint($item)
					if (!columnPoint) continue
					break
				}
				if (iRawColumnPositions[iRawColumn]>=$container.children.length) continue
				if (!$item || !isItem($item) || !columnPoint) continue
				if (point && isGreaterElementSequencePoint(point,columnPoint)) continue
				if (!point || isGreaterElementSequencePoint(columnPoint,point)) {
					point=columnPoint
					rawItems=[[iRawColumn,$item]]
				} else {
					rawItems.push([iRawColumn,$item])
				}
			}
			if (!point) break
			for (const [iRawColumn] of rawItems) {
				iRawColumnPositions[iRawColumn]++
			}
			const items: [iColumn: number, $item: HTMLElement][] = rawItems.map(([iRawColumn,$item])=>[
				iRawColumn==0?Number($item.dataset.column):iRawColumn-1,
				$item
			])
			yield [point,items]
		}
	}
	put(iColumns: number[], $items: HTMLElement[]): void {
		for (const [iItem,iColumn] of iColumns.entries()) {
			const $cell=this.$row.cells[iColumn+1]
			const $item=$items[iItem]
			$cell.replaceChildren(
				makeDiv()($item)
			)
		}
	}
	stretch(): void {
		if (this.isStretched) return
		const nTotalColumns=this.$row.cells.length+1
		const itemSequence=[...this.getItemSequence()]
		const $stretchCell=this.$row.cells[0]
		$stretchCell.colSpan=nTotalColumns
		for (const [iRawColumn,$cell] of [...this.$row.cells].entries()) {
			if (iRawColumn==0) continue
			$cell.hidden=true
		}
		let [$stretchContainer]=$stretchCell.children
		if (!($stretchContainer instanceof HTMLElement)) {
			$stretchCell.append(
				$stretchContainer=makeDiv()()
			)
		}
		$stretchCell.append($stretchContainer)
		for (const [,items] of itemSequence) {
			const [[iColumn,$item]]=items
			$item.dataset.column=String(iColumn)
			appendToContainer($stretchContainer,$item)
		}
	}
	shrink(): void {
		if (!this.isStretched) return
		const $stretchCell=this.$row.cells[0]
		$stretchCell.removeAttribute('colspan')
		for (const [iRawColumn,$cell] of [...this.$row.cells].entries()) {
			if (iRawColumn==0) continue
			$cell.hidden=false
		}
		const [$stretchContainer]=$stretchCell.children
		if (!($stretchContainer instanceof HTMLElement)) return
		for (const $item of $stretchContainer.querySelectorAll(':scope > .item')) {
			if (!($item instanceof HTMLElement)) continue
			const iColumn=Number($item.dataset.column)
			const $targetCell=this.$row.cells[iColumn+1]
			if (!($targetCell instanceof HTMLTableCellElement)) continue
			let [$targetContainer]=$targetCell.children
			if (!($targetContainer instanceof HTMLElement)) {
				$targetCell.append($targetContainer=makeDiv()())
			}
			appendToContainer($targetContainer,$item)
		}
		$stretchContainer.replaceChildren()
	}
	reorderColumns(iShiftFrom: number, iShiftTo: number): void {
		const $cells=[...this.$row.cells]
		moveInArray($cells,iShiftFrom+1,iShiftTo+1)
		this.$row.replaceChildren(...$cells)
		const nColumns=this.$row.cells.length-1
		const iMap=Array(nColumns).fill(0).map((_,i)=>i)
		moveInArray(iMap,iShiftTo,iShiftFrom)
		const $stretchCell=this.$row.cells[0]
		for (const $item of $stretchCell.querySelectorAll(':scope > * > .item')) {
			if (!($item instanceof HTMLElement)) continue
			const iColumn=Number($item.dataset.column)
			if (iMap[iColumn]!=null) {
				$item.dataset.column=String(iMap[iColumn])
			}
		}
	}
}

function appendToContainer($container: Element, $item: HTMLElement): void {
	if ($container.children.length>0) {
		$container.append(` `)
	}
	$container.append($item)
}
