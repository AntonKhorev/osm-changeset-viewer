import type {ItemSequencePoint} from './info'
import {readItemSequencePoint, writeElementSequencePoint, isGreaterElementSequencePoint} from './info'
import {makeCollectionIcon} from './body-item'
import {makeElement} from '../util/html'

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
	 *
	 * @returns new row with collection items lesser than the sequence point
	 */
	split(sequencePoint: ItemSequencePoint): HTMLTableRowElement {
		const $splitRow=makeElement('tr')('collection')()
		for (const $cell of this.$row.cells) {
			const $splitCell=$splitRow.insertCell()
			if ($cell.classList.contains('with-timeline-below')) {
				$splitCell.classList.add('with-timeline-below')
			}
			if ($cell.classList.contains('with-timeline-above')) {
				$cell.classList.add('with-timeline-below')
				$splitCell.classList.add('with-timeline-above')
			}
			const style=$cell.getAttribute('style')
			if (style) {
				$splitCell.setAttribute('style',style)
			}
			let startedMoving=false
			let nItems=0
			const $itemsToMove:HTMLElement[]=[]
			for (const $item of $cell.children) {
				if (!($item instanceof HTMLElement) || !$item.classList.contains('item')) continue
				nItems++
				if (!startedMoving) {
					const collectionItemSequencePoint=readItemSequencePoint($item)
					if (!collectionItemSequencePoint) continue
					if (isGreaterElementSequencePoint(sequencePoint,collectionItemSequencePoint)) {
						startedMoving=true
					}
				}
				if (startedMoving) {
					$itemsToMove.push($item)
				}
			}
			if ($itemsToMove.length>0) {
				$splitCell.append(makeCollectionIcon())
			}
			for (const $item of $itemsToMove) {
				$splitCell.append($item)
			}
			if (nItems<=$itemsToMove.length) {
				const $icon=$cell.children[0]
				if ($icon && $icon.classList.contains('icon')) {
					$icon.remove()
				}
			}
		}
		return $splitRow
	}
	/**
	 * Insert item placeholders, adding cell icons if they were missing
	 */
	insert(sequencePoint: ItemSequencePoint, iColumns: number[]): HTMLElement[] {
		return iColumns.map(iColumn=>{
			const $placeholder=makeElement('span')('item')()
			writeElementSequencePoint($placeholder,sequencePoint)
			const $cell=this.$row.cells[iColumn]
			let nItems=0
			for (const $item of $cell.children) {
				if (!($item instanceof HTMLElement) || !$item.classList.contains('item')) continue
				nItems++
				const collectionItemSequencePoint=readItemSequencePoint($item)
				if (!collectionItemSequencePoint) continue
				if (isGreaterElementSequencePoint(sequencePoint,collectionItemSequencePoint)) {
					$item.before($placeholder)
					return $placeholder
				}
			}
			if (nItems==0) {
				const $icon=makeCollectionIcon()
				$cell.prepend($icon)
				$icon.after($placeholder)
			} else {
				const $lastChild=$cell.lastElementChild as Element
				$lastChild.after($placeholder)
			}
			return $placeholder
		})
	}
}
