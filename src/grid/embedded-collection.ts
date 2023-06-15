import ItemCollection from './collection'
import type {ItemSequencePoint} from './info'
import {isItem} from './info'

export default class EmbeddedItemCollection {
	collection: ItemCollection
	constructor(
		rowOrCollection: HTMLTableRowElement|ItemCollection
	) {
		if (rowOrCollection instanceof ItemCollection) {
			this.collection=rowOrCollection
		} else {
			this.collection=new ItemCollection(rowOrCollection)
		}
	}
	getBoundarySequencePoints(): [
		greaterPoint: ItemSequencePoint|null,
		lesserPoint: ItemSequencePoint|null
	] {
		return this.collection.getBoundarySequencePoints()
	}
	split(sequencePoint: ItemSequencePoint, withCompactIds: boolean): EmbeddedItemCollection {
		const splitCollection=this.collection.split(sequencePoint)
		this.collection.$row.after(splitCollection.$row)
		const splitGridCollection=new EmbeddedItemCollection(splitCollection)
		splitGridCollection.updateIds(withCompactIds)
		return splitGridCollection
	}
	cut(withCompactIds: boolean): void {
		const $row=this.collection.$row
		const $prevRow=$row.previousElementSibling
		const $nextRow=$row.nextElementSibling
		$row.remove()
		if (
			$prevRow && $prevRow instanceof HTMLTableRowElement && $prevRow.classList.contains('collection') &&
			$nextRow && $nextRow instanceof HTMLTableRowElement && $nextRow.classList.contains('collection')
		) {
			const prevEmbeddedCollection=new EmbeddedItemCollection($prevRow)
			const nextEmbeddedCollection=new EmbeddedItemCollection($nextRow)
			prevEmbeddedCollection.collection.merge(nextEmbeddedCollection.collection)
			nextEmbeddedCollection.collection.$row.remove()
			prevEmbeddedCollection.updateIds(withCompactIds)
		}
	}
	insert(sequencePoint: ItemSequencePoint, iColumns: number[], $items: HTMLElement[], withCompactIds: boolean): void {
		this.collection.insert(sequencePoint,iColumns,$items)
		this.updateIds(withCompactIds)
	}
	remove($items: Iterable<HTMLElement>, withCompactIds: boolean): void {
		this.collection.remove($items)
		if (this.collection.isEmpty()) {
			this.collection.$row.remove()
		} else {
			this.updateIds(withCompactIds)
		}
	}
	updateIds(withCompactIds: boolean): void {
		for (const $cell of this.collection.$row.cells) {
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
		yield *this.collection.getItemSequence()
	}
}
