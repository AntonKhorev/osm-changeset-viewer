import ItemCollection from './collection'
import type {ItemSequencePoint} from './info'
import {isItem} from './info'

export default class EmbeddedItemCollection {
	collection: ItemCollection
	constructor(
		rowOrCollection: HTMLTableRowElement|ItemCollection,
		private withCompactIds: boolean
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
	split(sequencePoint: ItemSequencePoint): EmbeddedItemCollection {
		const splitCollection=this.collection.split(sequencePoint)
		this.collection.$row.after(splitCollection.$row)
		const splitGridCollection=new EmbeddedItemCollection(splitCollection,this.withCompactIds)
		splitGridCollection.updateIds()
		return splitGridCollection
	}
	merge(that: EmbeddedItemCollection): void {
		this.collection.merge(that.collection)
		that.collection.$row.remove()
		this.updateIds()
	}
	insert(sequencePoint: ItemSequencePoint, iColumns: number[], $items: HTMLElement[]): void {
		this.collection.insert(sequencePoint,iColumns,$items)
		this.updateIds()
	}
	remove($items: Iterable<HTMLElement>): void {
		this.collection.remove($items)
		if (this.collection.isEmpty()) {
			this.collection.$row.remove()
		} else {
			this.updateIds()
		}
	}
	updateIds(): void {
		for (const $cell of this.collection.$row.cells) {
			let lastId=''
			for (const $item of $cell.children) {
				if (!isItem($item)) continue
				if ($item.classList.contains('hidden')) continue
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
				if (this.withCompactIds && id.length==lastId.length) {
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
