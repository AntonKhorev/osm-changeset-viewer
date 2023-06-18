import ItemRow, {getCellContainer} from './row'
import ItemCollectionRow ,{removeSpaceBefore} from './collection-row'
import type {ItemSequencePoint} from './info'
import {isItem} from './info'
import {makeElement, makeDiv} from '../util/html'

export default class EmbeddedItemRow {
	row: ItemRow
	constructor(
		row: HTMLTableRowElement|ItemRow
	) {
		if (row instanceof ItemRow) {
			this.row=row
		} else if (row.classList.contains('collection')) {
			this.row=new ItemCollectionRow(row)
		} else {
			this.row=new ItemRow(row)
		}
	}
	static fromEmptyRow(
		$row: HTMLTableRowElement,
		className: string, columnHues: (number|null)[]
	): EmbeddedItemRow {
		$row.insertCell()
		$row.classList.add(className)
		for (const hue of columnHues) {
			const $cell=$row.insertCell()
			if (hue!=null) {
				$cell.style.setProperty('--hue',String(hue))
			}
		}
		const embeddedRow=new EmbeddedItemRow($row)
		embeddedRow.addStretchButton()
		return embeddedRow
	}
	static isItemRow($row: HTMLTableRowElement): boolean {
		return (
			$row.classList.contains('single') ||
			$row.classList.contains('collection')
		)
	}
	get isStretched(): boolean {
		return this.row.isStretched
	}
	getBoundarySequencePoints(): [
		greaterPoint: ItemSequencePoint|null,
		lesserPoint: ItemSequencePoint|null
	] {
		return this.row.getBoundarySequencePoints()
	}
	paste($row: HTMLTableRowElement, sequencePoint: ItemSequencePoint, withCompactIds: boolean): void {
		this.removeStretchButton()
		this.row.$row.after($row)
		if (!(this.row instanceof ItemCollectionRow)) return
		const splitRow=this.row.split(sequencePoint)
		$row.after(splitRow.$row)
		const splitEmbeddedRow=new EmbeddedItemRow(splitRow)
		splitEmbeddedRow.updateIds(withCompactIds)
		this.addStretchButton()
		splitEmbeddedRow.addStretchButton()
	}
	cut(withCompactIds: boolean): void {
		const $row=this.row.$row
		const $prevRow=$row.previousElementSibling
		const $nextRow=$row.nextElementSibling
		$row.remove()
		if (
			$prevRow && $prevRow instanceof HTMLTableRowElement &&
			$nextRow && $nextRow instanceof HTMLTableRowElement
		) {
			const prevEmbeddedRow=new EmbeddedItemRow($prevRow)
			const nextEmbeddedRow=new EmbeddedItemRow($nextRow)
			if (
				prevEmbeddedRow.row instanceof ItemCollectionRow &&
				nextEmbeddedRow.row instanceof ItemCollectionRow
			) {
				prevEmbeddedRow.removeStretchButton()
				nextEmbeddedRow.removeStretchButton()
				prevEmbeddedRow.row.merge(nextEmbeddedRow.row)
				nextEmbeddedRow.row.$row.remove()
				prevEmbeddedRow.updateIds(withCompactIds)
				prevEmbeddedRow.addStretchButton()
			}
		}
	}
	put(iColumns: number[], $items: HTMLElement[]): void {
		this.row.put(iColumns,$items)
	}
	insert(sequencePoint: ItemSequencePoint, iColumns: number[], $items: HTMLElement[], withCompactIds: boolean): void {
		if (!(this.row instanceof ItemCollectionRow)) throw new TypeError(`attempt to insert into non-collection row`)
		this.removeStretchButton()
		this.row.insert(sequencePoint,iColumns,$items)
		this.updateIds(withCompactIds)
		this.addStretchButton()
	}
	remove($items: Iterable<HTMLElement>, withCompactIds: boolean): void {
		if (!(this.row instanceof ItemCollectionRow)) throw new TypeError(`attempt to remove from non-collection row`)
		this.removeStretchButton()
		this.row.remove($items)
		if (this.row.isEmpty()) {
			this.row.$row.remove()
		} else {
			this.updateIds(withCompactIds)
		}
		this.addStretchButton()
	}
	stretch(withCompactIds: boolean): void {
		this.removeStretchButton()
		this.row.stretch()
		this.updateIds(withCompactIds)
		this.addStretchButton()
	}
	shrink(withCompactIds: boolean): void {
		this.removeStretchButton()
		this.row.shrink()
		this.updateIds(withCompactIds)
		this.addStretchButton()
	}
	updateIds(withCompactIds: boolean): void {
		for (const $cell of this.row.$row.cells) {
			let lastId=''
			for (const $item of $cell.querySelectorAll(':scope > * > .item')) {
				if (!isItem($item)) continue
				if ($item.hidden) continue
				const $a=$item.querySelector(':scope > .ballon > .flow > a')
				if (!($a instanceof HTMLAnchorElement)) {
					lastId=''
					continue
				}
				const id=$item.dataset.id
				if (id==null) {
					lastId=''
					continue
				}
				let compacted=false
				if (withCompactIds && id.length==lastId.length) {
					let shortId=''
					for (let i=0;i<id.length;i++) {
						if (id[i]==lastId[i]) continue
						shortId=id.substring(i)
						break
					}
					if (id.length-shortId.length>2) {
						$a.textContent='...'+shortId
						$a.title=id
						compacted=true
					}
				}
				if (!compacted) {
					$a.textContent=id
					$a.removeAttribute('title')
				}
				lastId=id
			}
		}
	}
	updateStretchButtonHiddenState(): void {
		const $button=this.row.$row.querySelector(':scope > :first-child > * > button.stretch')
		if (!($button instanceof HTMLButtonElement)) return
		$button.hidden=!this.row.$row.querySelector('.item:not([hidden])')
	}
	*getItemSequence(): Iterable<[point: ItemSequencePoint, items: [iColumn: number, $item: HTMLElement][]]> {
		yield *this.row.getItemSequence()
	}
	reorderColumns(iShiftFrom: number, iShiftTo: number): void {
		this.row.reorderColumns(iShiftFrom,iShiftTo)
	}
	private removeStretchButton(): void {
		const $stretchButton=this.row.$row.querySelector(':scope > :first-child > * > button.stretch')
		if (!$stretchButton) return
		removeSpaceBefore($stretchButton)
		$stretchButton.remove()
	}
	private addStretchButton(): void {
		const $button=makeElement('button')('stretch')(this.isStretched?`><`:`<>`)
		$button.title=this.isStretched?`Show in multiple columns`:`Show in one stretched column`
		const $stretchCell=this.row.$row.cells[0]
		const $stretchContainer=getCellContainer($stretchCell)
		if ($stretchContainer.hasChildNodes()) {
			$stretchContainer.append(` `)
		}
		$stretchContainer.append($button)
		this.updateStretchButtonHiddenState()
	}
}
