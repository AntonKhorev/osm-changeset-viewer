import ItemRow from './row'
import type {ItemSequencePoint} from './info'
import {isItem, readItemSequencePoint, isGreaterElementSequencePoint} from './info'
import {makeCollectionIcon} from './body-item'
import {makeElement} from '../util/html'

export default class ItemCollectionRow extends ItemRow {
	constructor(
		$row: HTMLTableRowElement
	) {
		super($row)
	}
	/**
	 * Split collection into two rows at the given sequence point
	 *
	 * @returns new row with collection items lesser than the sequence point
	 */
	split(sequencePoint: ItemSequencePoint): ItemCollectionRow {
		const $splitRow=makeElement('tr')('collection')()
		for (const $cell of this.$row.cells) {
			const $splitCell=$splitRow.insertCell()
			const style=$cell.getAttribute('style')
			if (style) {
				$splitCell.setAttribute('style',style)
			}
			let startedMoving=false
			let nItems=0
			const $itemsToMove:HTMLElement[]=[]
			for (const $item of $cell.children) {
				if (!isItem($item)) continue
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
				removeSpaceBefore($item)
				$splitCell.append(` `,$item)
			}
			if (nItems<=$itemsToMove.length) {
				const $icon=$cell.children[0]
				if ($icon && $icon.classList.contains('icon')) {
					$icon.remove()
				}
			}
			if ($cell.classList.contains('with-timeline-below')) {
				$splitCell.classList.add('with-timeline-above')
				$splitCell.classList.add('with-timeline-below')
			}
			if ($cell.classList.contains('with-timeline-above') && $itemsToMove.length>0) {
				$cell.classList.add('with-timeline-below')
				$splitCell.classList.add('with-timeline-above')
			}
		}
		return new ItemCollectionRow($splitRow)
	}
	merge(that: ItemCollectionRow): void {
		const $cells1=[...this.$row.cells]
		const $cells2=[...that.$row.cells]
		for (let i=0;i<$cells1.length&&i<$cells2.length;i++) {
			const $cell1=$cells1[i]
			const $cell2=$cells2[i]
			if (!$cell2) continue
			if (!$cell1) {
				this.$row.append($cell2)
				continue
			}
			let copying=false
			for (const $child of [...$cell2.children]) {
				if ($child.classList.contains('item')) {
					copying=true
					if ($cell1.children.length==0) {
						$cell1.append(makeCollectionIcon())
					}
				}
				if (copying) {
					$cell1.append($child)
					$child.before(' ')
				}
			}
			$cell1.classList.toggle('with-timeline-below',$cell2.classList.contains('with-timeline-below'))
		}
	}
	/**
	 * Insert items, adding cell icons if they were missing
	 */
	insert(sequencePoint: ItemSequencePoint, iColumns: number[], $items: HTMLElement[]): void {
		itemLoop: for (let iItem=0;iItem<iColumns.length;iItem++) {
			const iColumn=iColumns[iItem]
			const $item=$items[iItem]
			const $cell=this.$row.cells[iColumn+1]
			let nItems=0
			for (const $existingItem of $cell.children) {
				if (!isItem($existingItem)) continue
				nItems++
				const collectionItemSequencePoint=readItemSequencePoint($existingItem)
				if (!collectionItemSequencePoint) continue
				if (isGreaterElementSequencePoint(sequencePoint,collectionItemSequencePoint)) {
					$existingItem.before($item,` `)
					continue itemLoop
				}
			}
			if (nItems==0) {
				const $icon=makeCollectionIcon()
				$cell.prepend($icon)
				$icon.after(` `,$item)
			} else {
				const $lastChild=$cell.lastElementChild as Element
				$lastChild.after(` `,$item)
			}
		}
	}
	remove($items: Iterable<HTMLElement>): void {
		for (const $item of $items) {
			const $cell=$item.parentElement
			if (!($cell instanceof HTMLTableCellElement)) continue
			if ($cell.parentElement!=this.$row) continue
			removeSpaceBefore($item)
			$item.remove()
			if ($cell.querySelector(':scope > .item')) continue
			$cell.replaceChildren()
		}
	}
}

function removeSpaceBefore($e: HTMLElement): void {
	const $s=$e.previousSibling
	if ($s?.nodeType!=document.TEXT_NODE) return
	if ($s.textContent!=' ') return
	$s.remove()
}
