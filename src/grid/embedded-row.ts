import ItemRow, {getCellContainer} from './row'
import ItemCollectionRow from './collection-row'
import type {ItemSequencePoint} from './info'
import {readCollapsedItemCommentPieceText, writeCollapsedItemCommentPieceText} from './info'
import {isItem} from './info'
import type Colorizer from '../colorizer'
import {makeElement, removeInlineElement} from '../util/html'

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
		className: string,
		colorizer: Colorizer,
		columnUids: (number|undefined)[]
	): EmbeddedItemRow {
		$row.classList.add(className)
		const $allCell=$row.insertCell()
		colorizer.writeHueAttributes($allCell,undefined)
		for (const uid of columnUids) {
			const $cell=$row.insertCell()
			colorizer.writeHueAttributes($cell,uid)
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
	paste($row: HTMLTableRowElement, sequencePoint: ItemSequencePoint, withAbbreviatedIds: boolean, withAbbreviatedComments: boolean): void {
		this.removeStretchButton()
		this.row.$row.after($row)
		if (!(this.row instanceof ItemCollectionRow)) return
		const splitRow=this.row.split(sequencePoint)
		$row.after(splitRow.$row)
		const splitEmbeddedRow=new EmbeddedItemRow(splitRow)
		splitEmbeddedRow.updateAbbreviations(withAbbreviatedIds,withAbbreviatedComments)
		this.addStretchButton()
		splitEmbeddedRow.addStretchButton()
	}
	cut(withAbbreviatedIds: boolean, withAbbreviatedComments: boolean): void {
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
				prevEmbeddedRow.updateAbbreviations(withAbbreviatedIds,withAbbreviatedComments)
				prevEmbeddedRow.addStretchButton()
			}
		}
	}
	put(iColumns: number[], $items: HTMLElement[]): void {
		this.row.put(iColumns,$items)
	}
	insert(sequencePoint: ItemSequencePoint, iColumns: number[], $items: HTMLElement[], withAbbreviatedIds: boolean, withAbbreviatedComments: boolean): void {
		if (!(this.row instanceof ItemCollectionRow)) throw new TypeError(`attempt to insert into non-collection row`)
		this.removeStretchButton()
		this.row.insert(sequencePoint,iColumns,$items)
		this.updateAbbreviations(withAbbreviatedIds,withAbbreviatedComments)
		this.addStretchButton()
	}
	remove($items: Iterable<HTMLElement>, withAbbreviatedIds: boolean, withAbbreviatedComments: boolean): void {
		if (!(this.row instanceof ItemCollectionRow)) throw new TypeError(`attempt to remove from non-collection row`)
		this.removeStretchButton()
		this.row.remove($items)
		if (this.row.isEmpty()) {
			this.row.$row.remove()
		} else {
			this.updateAbbreviations(withAbbreviatedIds,withAbbreviatedComments)
		}
		this.addStretchButton()
	}
	stretch(withAbbreviatedIds: boolean, withAbbreviatedComments: boolean): void {
		this.removeStretchButton()
		this.row.stretch()
		this.updateAbbreviations(withAbbreviatedIds,withAbbreviatedComments)
		this.addStretchButton()
	}
	shrink(withAbbreviatedIds: boolean, withAbbreviatedComments: boolean): void {
		this.removeStretchButton()
		this.row.shrink()
		this.updateAbbreviations(withAbbreviatedIds,withAbbreviatedComments)
		this.addStretchButton()
	}
	updateAbbreviations(withAbbreviatedIds: boolean, withAbbreviatedComments: boolean): void {
		const startAbbreviator=(
			withAbbreviation: boolean,
			getValue:($item:HTMLElement,$piece:HTMLElement)=>string|null,
			setLongValue:($piece:HTMLElement,value:string)=>void,
			setShortValue:($piece:HTMLElement,value:string,shortValue:string)=>void,
		)=>{
			let lastValue=''
			return ($item:HTMLElement,$piece:Element|null)=>{
				if (!($piece instanceof HTMLElement)) {
					lastValue=''
					return
				}
				if ($piece.hidden) return
				const value=getValue($item,$piece)
				if (value==null) {
					lastValue=''
					return
				}
				let compacted=false
				if (withAbbreviation && value.length==lastValue.length) {
					let shortValue=''
					for (let i=0;i<value.length;i++) {
						if (value[i]==lastValue[i]) continue
						shortValue=value.substring(i)
						break
					}
					if (value.length-shortValue.length>2) {
						setShortValue($piece,value,shortValue)
						compacted=true
					}
				}
				if (!compacted) {
					setLongValue($piece,value)
				}
				lastValue=value
			}
		}
		for (const $cell of this.row.$row.cells) {
			const idAbbreviator=startAbbreviator(
				withAbbreviatedIds,
				$item=>$item.dataset.id??null,
				($piece,value)=>{
					$piece.textContent=value
					$piece.removeAttribute('title')
				},
				($piece,value,shortValue)=>{
					$piece.textContent='...'+shortValue
					$piece.title=value
				}
			)
			const commentAbbreviator=startAbbreviator(
				withAbbreviatedComments,
				(_,$piece)=>readCollapsedItemCommentPieceText($piece),
				($piece,value)=>writeCollapsedItemCommentPieceText($piece,value),
				($piece,value,shortValue)=>writeCollapsedItemCommentPieceText($piece,value,shortValue)
			)
			for (const $item of $cell.querySelectorAll(':scope > * > .item')) {
				if (!isItem($item)) continue
				if ($item.hidden) continue
				idAbbreviator($item,$item.querySelector(':scope > .balloon > .flow > a[data-optional="id"]'))
				commentAbbreviator($item,$item.querySelector(':scope > .balloon > .flow > [data-optional="comment"]'))
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
		removeInlineElement($stretchButton)
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
