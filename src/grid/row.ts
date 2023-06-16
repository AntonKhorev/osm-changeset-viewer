import type {ItemSequencePoint} from './info'
import {isItem, readItemSequencePoint, isGreaterElementSequencePoint} from './info'

export default class ItemRow {
	constructor(
		public $row: HTMLTableRowElement
	) {}
	isEmpty(): boolean {
		return !this.$row.querySelector(':scope > td > .item')
	}
	getBoundarySequencePoints(): [
		greaterPoint: ItemSequencePoint|null,
		lesserPoint: ItemSequencePoint|null
	] {
		let greaterPoint: ItemSequencePoint|null = null
		let lesserPoint: ItemSequencePoint|null = null
		for (const $cell of this.$row.cells) {
			for (const $item of $cell.children) {
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
		const nColumns=this.$row.cells.length-1
		if (nColumns==0) return
		const iColumnPositions=Array<number>(nColumns).fill(0)
		while (true) {
			let point: ItemSequencePoint|undefined
			let items: [iColumn: number, $item: HTMLElement][] = []
			for (const [iRawColumn,$cell] of [...this.$row.cells].entries()) {
				if (iRawColumn==0) continue
				const iColumn=iRawColumn-1
				let $item: Element|undefined
				let columnPoint: ItemSequencePoint|null = null
				for (;iColumnPositions[iColumn]<$cell.children.length;iColumnPositions[iColumn]++) {
					$item=$cell.children[iColumnPositions[iColumn]]
					if (!isItem($item)) continue
					columnPoint=readItemSequencePoint($item)
					if (!columnPoint) continue
					break
				}
				if (iColumnPositions[iColumn]>=$cell.children.length) continue
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
}