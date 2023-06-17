import ItemRow from './row'
import type {ItemSequencePoint} from './info'
import {isItem, readItemSequencePoint, isGreaterElementSequencePoint} from './info'
import {makeCollectionIcon} from './body-item'
import {makeElement, makeDiv} from '../util/html'

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
			const [$container]=$cell.children
			const $splitContainer=makeDiv()()
			$splitCell.append($splitContainer)
			let startedMoving=false
			let nItems=0
			const $itemsToMove:HTMLElement[]=[]
			if ($container instanceof HTMLElement) {
				for (const $item of $container.children) {
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
					$splitContainer.append(makeCollectionIcon())
				}
				for (const $item of $itemsToMove) {
					removeSpaceBefore($item)
					$splitContainer.append(` `,$item)
				}
				if (nItems<=$itemsToMove.length) {
					const $icon=$container.children[0]
					if ($icon && $icon.classList.contains('icon')) {
						$icon.remove()
					}
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
			if ($cell.colSpan>1) {
				$splitCell.colSpan=$cell.colSpan
			}
			if ($cell.hidden) {
				$splitCell.hidden=true
			}
		}
		return new ItemCollectionRow($splitRow)
	}
	merge(that: ItemCollectionRow): void {
		const copyChildren=($container1:HTMLElement,$container2:HTMLElement)=>{
			let copying=false
			for (const $child of [...$container2.children]) {
				if ($child.classList.contains('item')) {
					copying=true
					if ($container1.children.length==0) {
						$container1.append(makeCollectionIcon())
					}
				}
				if (copying) {
					$container1.append($child)
					$child.before(' ')
				}
			}
		}
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
			const [$container1]=$cell1.children
			const [$container2]=$cell2.children
			if ($container2 instanceof HTMLElement) {
				if ($container1 instanceof HTMLElement) {
					copyChildren($container1,$container2)
				} else {
					$cell1.append($container2)
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
			const $item=$items[iItem]
			const iColumn=iColumns[iItem]
			let $cell: HTMLTableCellElement
			if (this.isStretched && iItem==0) {
				$cell=this.$row.cells[0]
				$item.dataset.column=String(iColumn)
			} else {
				$cell=this.$row.cells[iColumn+1]
			}
			let [$container]=$cell.children
			if (!($container instanceof HTMLElement)) {
				$cell.append(
					$container=makeDiv()()
				)
			}
			let nItems=0
			for (const $existingItem of $container.children) {
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
				$container.prepend($icon)
				$icon.after(` `,$item)
			} else {
				const $lastChild=$container.lastElementChild as Element
				$lastChild.after(` `,$item)
			}
		}
	}
	remove($items: Iterable<HTMLElement>): void {
		for (const $item of $items) {
			const $container=$item.parentElement
			if (!($container instanceof HTMLElement)) continue
			const $cell=$container.parentElement
			if (!($cell instanceof HTMLTableCellElement)) continue
			if ($cell.parentElement!=this.$row) continue
			removeSpaceBefore($item)
			$item.remove()
			if ($container.querySelector(':scope > .item')) continue
			$container.replaceChildren()
		}
	}
	stretch(): void {
		super.stretch()
		this.fixCollectionIcons()
	}
	shrink(): void {
		super.shrink()
		this.fixCollectionIcons()
	}
	private fixCollectionIcons(): void {
		for (const $cell of this.$row.cells) {
			const $container=$cell.firstElementChild
			if (!($container instanceof HTMLElement)) continue
			if (!$container.querySelector(':scope > .item')) {
				$container.replaceChildren()
			} else {
				const $firstChild=$container.firstElementChild
				if (!($firstChild instanceof HTMLElement)) return
				if ($firstChild.classList.contains('icon')) return
				$container.prepend(makeCollectionIcon(),` `)
			}
		}
	}
}

function removeSpaceBefore($e: HTMLElement): void {
	const $s=$e.previousSibling
	if ($s?.nodeType!=document.TEXT_NODE) return
	if ($s.textContent!=' ') return
	$s.remove()
}
