import type {ItemSequencePoint} from './info'
import {readItemSequencePoint, isGreaterElementSequencePoint} from './info'

export default class GridBodyCollectionRow {
	constructor(private $row: HTMLTableRowElement) {}
	/**
	 * Check if all collection items are greater than the given sequence point (1), all are less than it (-1), some are greater and some are less (0)
	 */
	compare(sequencePoint: ItemSequencePoint): -1|0|1 {
		let hasGreaterItem=false
		let hasLesserItem=false
		for (const $cell of this.$row.cells) {
			for (const $item of $cell.children) {
				if (!($item instanceof HTMLElement) || !$item.classList.contains('item')) continue
				const collectionItemSequencePoint=readItemSequencePoint($item)
				if (!collectionItemSequencePoint) continue
				if (isGreaterElementSequencePoint(collectionItemSequencePoint,sequencePoint)) {
					hasGreaterItem=true
				} else {
					hasLesserItem=true
				}
				if (hasGreaterItem && hasLesserItem) return 0
			}
		}
		return hasGreaterItem?1:-1
	}
	/**
	 * Split collection into two rows at the given sequence point
	 */
	split(sequencePoint: ItemSequencePoint): void {
		// TODO
	}
	/**
	 * Insert item placeholders, adding cell icons if they were missing
	 */
	insert(sequencePoint: ItemSequencePoint, iColumns: number[]): HTMLElement[] {
		return [] // TODO
	}
}
