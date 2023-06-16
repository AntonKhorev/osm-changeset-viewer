import ItemRow from './row'
import ItemCollectionRow from './collection-row'
import type {ItemSequencePoint} from './info'
import {isItem} from './info'

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
	getBoundarySequencePoints(): [
		greaterPoint: ItemSequencePoint|null,
		lesserPoint: ItemSequencePoint|null
	] {
		return this.row.getBoundarySequencePoints()
	}
	paste($row: HTMLTableRowElement, sequencePoint: ItemSequencePoint, withCompactIds: boolean): void {
		this.row.$row.after($row)
		if (!(this.row instanceof ItemCollectionRow)) return
		const splitRow=this.row.split(sequencePoint)
		$row.after(splitRow.$row)
		const splitEmbeddedRow=new EmbeddedItemRow(splitRow)
		splitEmbeddedRow.updateIds(withCompactIds)
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
				prevEmbeddedRow.row.merge(nextEmbeddedRow.row)
				nextEmbeddedRow.row.$row.remove()
				prevEmbeddedRow.updateIds(withCompactIds)
			}
		}
	}
	insert(sequencePoint: ItemSequencePoint, iColumns: number[], $items: HTMLElement[], withCompactIds: boolean): void {
		if (!(this.row instanceof ItemCollectionRow)) throw new TypeError(`attempt to insert into non-collection row`)
		this.row.insert(sequencePoint,iColumns,$items)
		this.updateIds(withCompactIds)
	}
	remove($items: Iterable<HTMLElement>, withCompactIds: boolean): void {
		if (!(this.row instanceof ItemCollectionRow)) throw new TypeError(`attempt to remove from non-collection row`)
		this.row.remove($items)
		if (this.row.isEmpty()) {
			this.row.$row.remove()
		} else {
			this.updateIds(withCompactIds)
		}
	}
	stretch(withCompactIds: boolean): void {
		this.row.stretch()
		this.updateIds(withCompactIds)
	}
	updateIds(withCompactIds: boolean): void {
		for (const $cell of this.row.$row.cells) {
			let lastId=''
			for (const $item of $cell.children) {
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
	*getItemSequence(): Iterable<[point: ItemSequencePoint, items: [iColumn: number, $item: HTMLElement][]]> {
		yield *this.row.getItemSequence()
	}
}
