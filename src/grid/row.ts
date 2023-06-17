import type {ItemSequencePoint} from './info'
import {isItem, readItemSequencePoint, isGreaterElementSequencePoint} from './info'
import {makeDiv} from '../util/html'

export default class ItemRow {
	constructor(
		public $row: HTMLTableRowElement
	) {}
	isEmpty(): boolean {
		return !this.$row.querySelector(':scope > td > * > .item')
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
		const nColumns=this.$row.cells.length-1 // TODO go with raw columns instead
		if (nColumns==0) return
		const iColumnPositions=Array<number>(nColumns).fill(0)
		while (true) {
			let point: ItemSequencePoint|undefined
			let items: [iColumn: number, $item: HTMLElement][] = []
			for (const [iRawColumn,$cell] of [...this.$row.cells].entries()) {
				if (iRawColumn==0) continue
				const [$container]=$cell.children
				if (!($container instanceof HTMLElement)) continue
				const iColumn=iRawColumn-1
				let $item: Element|undefined
				let columnPoint: ItemSequencePoint|null = null
				for (;iColumnPositions[iColumn]<$container.children.length;iColumnPositions[iColumn]++) {
					$item=$container.children[iColumnPositions[iColumn]]
					if (!isItem($item)) continue
					columnPoint=readItemSequencePoint($item)
					if (!columnPoint) continue
					break
				}
				if (iColumnPositions[iColumn]>=$container.children.length) continue
				if (!$item || !isItem($item) || !columnPoint) continue
				if (point && isGreaterElementSequencePoint(point,columnPoint)) continue
				if (!point || isGreaterElementSequencePoint(columnPoint,point)) {
					point=columnPoint
					items=[[iColumn,$item]]
				} else {
					items.push([iColumn,$item])
				}
			}
			if (!point) break
			for (const [iColumn] of items) {
				iColumnPositions[iColumn]++
			}
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
		const nTotalColumns=this.$row.cells.length+1
		const itemSequence=[...this.getItemSequence()]
		const $stretchCell=this.$row.cells[0]
		$stretchCell.colSpan=nTotalColumns
		let [$stretchContainer]=$stretchCell.children
		if (!($stretchContainer instanceof HTMLElement)) {
			$stretchCell.append(
				$stretchContainer=makeDiv()()
			)
		}
		$stretchCell.append($stretchContainer)
		for (const [iRawColumn,$cell] of [...this.$row.cells].entries()) {
			if (iRawColumn==0) continue
			$cell.hidden=true
		}
		for (const [,items] of itemSequence) {
			const [[iColumn,$item]]=items
			$item.dataset.column=String(iColumn)
			$stretchContainer.append(` `,$item)
		}
	}
}
