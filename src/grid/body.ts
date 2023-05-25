import type {ServerUrlGetter} from './body-item'
import type {SingleItemDBReader} from '../db'
import type {ItemDescriptor, ItemSequencePoint} from './info'
import {
	readItemDescriptor, getItemDescriptorSelector, isEqualItemDescriptor,
	isGreaterElementSequencePoint, writeSeparatorSequencePoint, readElementSequencePoint, writeElementSequencePoint,
	getBatchItemSequencePoint, readItemSequencePoint
} from './info'
import {
	getItemCheckbox, getItemDisclosureButton, getItemDisclosureButtonState, setItemDisclosureButtonState,
	makeItemShell, writeCollapsedItemFlow, writeExpandedItemFlow
} from './body-item'
import EmbeddedItemCollection from './embedded-collection'
import {updateTimelineOnInsert} from './timeline'
import GridBodyCheckboxHandler from './body-checkbox'
import type {GridBatchItem} from '../mux-user-item-db-stream-messenger'
import type {MuxBatchItem} from '../mux-user-item-db-stream'
import {toIsoYearMonthString} from '../date'
import {makeElement, makeDiv} from '../util/html'
import {moveInArray} from '../util/types'

export default class GridBody {
	readonly $gridBody=makeElement('tbody')()()
	withCompactIds=false
	withClosedChangesets=false
	inOneColumn=false
	private checkboxHandler=new GridBodyCheckboxHandler(this.$gridBody)
	private readonly wrappedItemDisclosureButtonListener: (ev:Event)=>void
	private nColumns=0
	constructor(
		private readonly server: ServerUrlGetter,
		private readonly itemReader: SingleItemDBReader,
		private readonly getColumnHues: ()=>(number|null)[]
	) {
		this.wrappedItemDisclosureButtonListener=(ev:Event)=>this.toggleItemDisclosureWithButton(ev.currentTarget)
	}
	set onItemSelect(callback: ()=>void) {
		this.checkboxHandler.onItemSelect=callback
	}
	setColumns(nColumns: number): void {
		this.nColumns=nColumns
		this.$gridBody.replaceChildren()
		this.checkboxHandler.resetLastClickedCheckbox()
		this.checkboxHandler.onItemSelect()
	}
	addItem(
		batchItem: GridBatchItem,
		usernames: Map<number, string>,
		isExpanded: boolean
	): boolean {
		const [$masterPlaceholder,classNames]=makeItemShell(batchItem,isExpanded)
		const $placeholders=batchItem.iColumns.map(()=>$masterPlaceholder.cloneNode(true) as HTMLElement)
		const sequencePoint=getBatchItemSequencePoint(batchItem)
		if (!sequencePoint) return false
		return this.insertItem(
			batchItem.iColumns,sequencePoint,
			!isExpanded?{isExpanded}:{isExpanded,batchItem,usernames},
			$placeholders,classNames
		)
	}
	updateTableAccordingToSettings(): void {
		const setCheckboxTitles=($item: HTMLElement, title: string)=>{
			if ($item instanceof HTMLTableRowElement) {
				for (const $cell of $item.cells) {
					const $checkbox=getItemCheckbox($cell)
					if ($checkbox) $checkbox.title=title
				}
			} else {
				const $checkbox=getItemCheckbox($item)
				if ($checkbox) $checkbox.title=title
			}
		}
		const combineChangesets=($item: HTMLElement, $laterItem: HTMLElement|undefined)=>{
			const isConnectedWithLaterItem=(
				$laterItem &&
				$laterItem.classList.contains('changeset') &&
				$laterItem.classList.contains('closed') &&
				$item.dataset.id==$laterItem.dataset.id
			)
			if ($item.classList.contains('changeset')) {
				if ($item.classList.contains('closed')) {
					$item.classList.toggle('hidden',!this.withClosedChangesets)
				} else {
					const id=$item.dataset.id??'???'
					if (isConnectedWithLaterItem || !this.withClosedChangesets) {
						if ($laterItem && isConnectedWithLaterItem) {
							$laterItem.classList.add('hidden')
						}
						$item.classList.add('combined')
						setCheckboxTitles($item,`changeset ${id}`)
					} else {
						$item.classList.remove('combined')
						setCheckboxTitles($item,`opened changeset ${id}`)
					}
				}
			}
		}
		const spanColumns=($row:HTMLTableRowElement)=>{
			let spanned=false
			for (const $cell of $row.cells) {
				if (this.inOneColumn) {
					if (!spanned && $cell.childNodes.length) {
						$cell.hidden=false
						$cell.colSpan=this.nColumns+1
						spanned=true
					} else {
						$cell.hidden=true
						$cell.removeAttribute('colspan')
					}
				} else {
					$cell.hidden=false
					$cell.removeAttribute('colspan')
				}
			}
		}
		let $itemRowAbove: HTMLElement|undefined
		for (const $row of this.$gridBody.rows) {
			if ($row.classList.contains('collection')) {
				for (const $cell of $row.cells) {
					let $laterItem: HTMLElement|undefined
					for (const $item of $cell.querySelectorAll(':scope > .item')) {
						if (!($item instanceof HTMLElement)) continue
						combineChangesets($item,$laterItem)
						$laterItem=$item
					}
				}
				const collection=new EmbeddedItemCollection($row,this.withCompactIds)
				collection.updateIds()
				// spanColumns($row) // TODO need to merge/split collected items in cells
				$itemRowAbove=undefined
			} else if ($row.classList.contains('item')) {
				combineChangesets($row,$itemRowAbove)
				spanColumns($row)
				$itemRowAbove=$row
			} else {
				$itemRowAbove=undefined
			}
		}
	}
	reorderColumns(iShiftFrom: number, iShiftTo: number): void {
		for (const $row of this.$gridBody.rows) {
			if (!$row.classList.contains('item') && !$row.classList.contains('collection')) continue
			const $cells=[...$row.cells]
			moveInArray($cells,iShiftFrom,iShiftTo)
			$row.replaceChildren(...$cells)
		}
	}
	getColumnCheckboxStatuses(): [
		hasChecked: boolean[],
		hasUnchecked: boolean[],
		selectedChangesetIds: Set<number>[]
	] {
		return this.checkboxHandler.getColumnCheckboxStatuses(this.nColumns)
	}
	listSelectedChangesetIds(): Iterable<number> {
		const [,,selectedChangesetIds]=this.checkboxHandler.getColumnCheckboxStatuses(this.nColumns)
		return union(selectedChangesetIds).values()
	}
	triggerColumnCheckboxes(iColumn: number, isChecked: boolean): void {
		this.checkboxHandler.triggerColumnCheckboxes(iColumn,isChecked)
	}
	collapseItem(descriptor: ItemDescriptor): void {
		const itemSelectorWithRow='tr'+getItemDescriptorSelector(descriptor)
		const $row=this.$gridBody.querySelector(itemSelectorWithRow) // TODO select all matching rows? but there can't be more than one
		if (!($row instanceof HTMLTableRowElement)) return
		const collapseRowItems=($row:HTMLTableRowElement)=>{
			const sequencePoint=readItemSequencePoint($row)
			if (!sequencePoint) return
			const itemCopies=listItemCopies($row,sequencePoint)
			const iColumns=itemCopies.map(([,iColumn])=>iColumn)
			const $placeholders=itemCopies.map(([$item])=>$item)
			const classNames=[...$row.classList]
			const $prevRow=$row.previousElementSibling
			const $nextRow=$row.nextElementSibling
			$row.remove()
			for (const $placeholder of $placeholders) {
				const $disclosureButton=getItemDisclosureButton($placeholder)
				if ($disclosureButton) {
					setItemDisclosureButtonState($disclosureButton,false)
				}
			}
			if (
				$prevRow && $prevRow instanceof HTMLTableRowElement && $prevRow.classList.contains('collection') &&
				$nextRow && $nextRow instanceof HTMLTableRowElement && $nextRow.classList.contains('collection')
			) {
				const collection=new EmbeddedItemCollection($prevRow,this.withCompactIds)
				const nextCollection=new EmbeddedItemCollection($nextRow,this.withCompactIds)
				collection.merge(nextCollection)
			}
			this.insertItem(iColumns,sequencePoint,{isExpanded:false},$placeholders,classNames)
		}
		let $precedingRow=$row.previousElementSibling
		const $precedingHiddenRows:HTMLTableRowElement[]=[]
		while ($precedingRow instanceof HTMLTableRowElement) {
			if (!isHiddenItem($precedingRow)) break
			$precedingHiddenRows.push($precedingRow)
			$precedingRow=$precedingRow.previousElementSibling
		}
		if ($precedingRow?.classList.contains('collection')) {
			for (const $row of $precedingHiddenRows) {
				collapseRowItems($row)
			}
		} else if ($row.classList.contains('combined')) {
			const $previousRow=$row.previousElementSibling
			if (
				$previousRow instanceof HTMLTableRowElement &&
				isHiddenItem($previousRow) &&
				isChangesetOpenedClosedPair($row,$previousRow)
			) {
				collapseRowItems($previousRow)
			}
		}
		let $followingRow=$row.nextElementSibling
		const $followingHiddenRows:HTMLTableRowElement[]=[]
		while ($followingRow instanceof HTMLTableRowElement) {
			if (!isHiddenItem($followingRow)) break
			$followingHiddenRows.push($followingRow)
			$followingRow=$followingRow.nextElementSibling
		}
		if ($followingRow?.classList.contains('collection')) {
			for (const $row of $followingHiddenRows) {
				collapseRowItems($row)
			}
		}
		collapseRowItems($row)
	}
	async expandItem(descriptor: ItemDescriptor): Promise<void> {
		const itemSelector=getItemDescriptorSelector(descriptor)
		const itemSelectorWithRow='tr.collection '+itemSelector
		const $items=this.$gridBody.querySelectorAll(itemSelectorWithRow)
		const $rows=new Set<HTMLTableRowElement>()
		for (const $item of $items) {
			const $row=$item.closest('tr')
			if (!$row) continue
			if (!$row.classList.contains('collection')) continue
			$rows.add($row)
		}
		for (const $row of $rows) {
			const collection=new EmbeddedItemCollection($row,this.withCompactIds)
			const itemSequence=[...collection.getItemSequence()]
			const isEverythingBetweenTargetPositionsHidden=[true]
			for (const [point,columnItems] of itemSequence) {
				if (isEqualItemDescriptor(descriptor,point)) {
					isEverythingBetweenTargetPositionsHidden.push(true)
				} else {
					isEverythingBetweenTargetPositionsHidden[
						isEverythingBetweenTargetPositionsHidden.length-1
					]&&=columnItems.every(([,$item])=>isHiddenItem($item))
				}
			}
			if (isEverythingBetweenTargetPositionsHidden.length<=1) continue
			let iTarget=0
			for (const [iPosition,[point,columnItems]] of itemSequence.entries()) {
				if (isEqualItemDescriptor(descriptor,point)) {
					if (!isEverythingBetweenTargetPositionsHidden[iTarget]) {
						const [previousPoint,previousColumnItems]=itemSequence[iPosition-1]
						if (isOpenedClosedPair(point,previousPoint)) {
							await this.expandItemRow(previousPoint,previousColumnItems)
						}
					}
					await this.expandItemRow(point,columnItems)
					iTarget++
				} else {
					if (isEverythingBetweenTargetPositionsHidden[iTarget]) {
						await this.expandItemRow(point,columnItems)
					}
				}
			}
		}
	}
	private async expandItemRow(point: ItemSequencePoint, items: [iColumn: number, $item: HTMLElement][]): Promise<void> {
		const makeUsernames=(uid?:number,username?:string)=>{
			if (uid==null || username==null) {
				return new Map<number,string>()
			} else {
				return new Map<number,string>([[uid,username]])
			}
		}
		const [[,$item]]=items
		const $row=$item.closest('tr')
		if (!$row) return
		let batchItem:MuxBatchItem
		let usernames:Map<number,string>
		if (point.type=='user') {
			const item=await this.itemReader.getUser(point.id)
			if (!item || !item.withDetails || !item.visible) return
			batchItem={type:point.type,item}
			usernames=makeUsernames()
		} else if (point.type=='changeset' || point.type=='changesetClose') {
			const item=await this.itemReader.getChangeset(point.id)
			if (!item) return
			batchItem={type:point.type,item}
			usernames=makeUsernames()
		} else if (point.type=='note') {
			const item=await this.itemReader.getNote(point.id)
			if (!item) return
			batchItem={type:point.type,item}
			usernames=makeUsernames()
		} else if (point.type=='changesetComment') {
			const {comment,username}=await this.itemReader.getChangesetComment(point.id,point.order??0)
			if (!comment) return
			batchItem={type:point.type,item:comment}
			usernames=makeUsernames(comment.uid,username)
		} else if (point.type=='noteComment') {
			const {comment,username}=await this.itemReader.getNoteComment(point.id,point.order??0)
			if (!comment) return
			batchItem={type:point.type,item:comment}
			usernames=makeUsernames(comment.uid,username)
		} else {
			return
		}
		const classNames=[...$item.classList]
		const $items=items.map(([,$item])=>$item)
		for (const $item of $items) {
			const $disclosureButton=getItemDisclosureButton($item)
			if ($disclosureButton) {
				setItemDisclosureButtonState($disclosureButton,true)
			}
		}
		const collection=new EmbeddedItemCollection($row,this.withCompactIds)
		collection.remove($items)
		const iColumns=items.map(([iColumn])=>iColumn)
		this.insertItem(iColumns,point,{isExpanded:true,batchItem,usernames},$items,classNames)
	}
	private insertItem(
		iColumns: number[],
		sequencePoint: ItemSequencePoint,
		insertItemInfo: {
			isExpanded: false
		} | {
			isExpanded: true
			batchItem: MuxBatchItem
			usernames: Map<number, string>
		},
		$previousPlaceholders: HTMLElement[],
		classNames: string[]
	): boolean {
		if (iColumns.length==0) return false
		this.insertItemPlaceholders(iColumns,sequencePoint,insertItemInfo.isExpanded,$previousPlaceholders,classNames,$placeholder=>{
			const $flow=$placeholder.querySelector('.flow')
			if (!($flow instanceof HTMLElement)) return
			if (insertItemInfo.isExpanded) {
				writeExpandedItemFlow($flow,this.server,insertItemInfo.batchItem,insertItemInfo.usernames)
			} else {
				writeCollapsedItemFlow($flow,this.server,sequencePoint.type,sequencePoint.id)
			}
			const $checkbox=getItemCheckbox($placeholder)
			if ($checkbox) {
				this.checkboxHandler.listen($checkbox)
			}
			const $disclosureButton=getItemDisclosureButton($placeholder)
			$disclosureButton?.addEventListener('click',this.wrappedItemDisclosureButtonListener)
		})
		return true
	}
	private insertItemPlaceholders(
		iColumns: number[],
		sequencePoint: ItemSequencePoint,
		isExpanded: boolean,
		$previousPlaceholders: HTMLElement[],
		classNames: string[],
		writeItem: ($placeholder:HTMLElement)=>void
	): void {
		const copyPlaceholderChildren=($placeholder:HTMLElement,iPlaceholder:number)=>{
			$placeholder.replaceChildren(
				...$previousPlaceholders[iPlaceholder].childNodes
			)
		}
		const insertionRowInfo=this.findInsertionRow(sequencePoint)
		if (isExpanded) {
			const $row=this.makeRow()
			{
				let $rowBefore:HTMLTableRowElement
				if (insertionRowInfo.type=='betweenRows') {
					$rowBefore=insertionRowInfo.$rowBefore
				} else {
					$rowBefore=insertionRowInfo.$row
					const collection=new EmbeddedItemCollection($rowBefore,this.withCompactIds)
					collection.split(sequencePoint)
				}
				$rowBefore.after($row)
			}
			$row.classList.add(...classNames)
			writeElementSequencePoint($row,sequencePoint)
			updateTimelineOnInsert($row,iColumns)
			for (const [iPlaceholder,iColumn] of iColumns.entries()) {
				const $placeholder=$row.cells[iColumn]
				copyPlaceholderChildren($placeholder,iPlaceholder)
				writeItem($placeholder)
			}
		} else {
			let $row: HTMLTableRowElement
			if (insertionRowInfo.type=='betweenRows') {
				if (insertionRowInfo.$rowBefore.classList.contains('collection')) {
					$row=insertionRowInfo.$rowBefore
					
				} else if (insertionRowInfo.$rowAfter?.classList.contains('collection')) {
					$row=insertionRowInfo.$rowAfter
				} else {
					$row=this.makeRow()
					$row.classList.add('collection')
					insertionRowInfo.$rowBefore.after($row)
				}
			} else {
				$row=insertionRowInfo.$row
			}
			updateTimelineOnInsert($row,iColumns)
			const collection=new EmbeddedItemCollection($row,this.withCompactIds)
			collection.insert(sequencePoint,iColumns,(iPlaceholder,$placeholder)=>{
				$placeholder.classList.add(...classNames)
				copyPlaceholderChildren($placeholder,iPlaceholder)
				writeItem($placeholder)
			})
		}
	}
	private makeRow(): HTMLTableRowElement {
		const $row=makeElement('tr')()()
		for (const hue of this.getColumnHues()) {
			const $cell=$row.insertCell()
			setCellHue($cell,hue)
		}
		return $row
	}
	private findInsertionRow(sequencePoint: ItemSequencePoint): {
		type: 'betweenRows'
		$rowBefore: HTMLTableRowElement
		$rowAfter: HTMLTableRowElement|undefined
	} | {
		type: 'insideRow'
		$row: HTMLTableRowElement
	} {
		for (let i=this.$gridBody.rows.length-1;i>=0;i--) {
			const $row=this.$gridBody.rows[i]
			const $rowAfter=this.$gridBody.rows[i+1]
			if ($row.classList.contains('collection')) {
				const collection=new EmbeddedItemCollection($row,this.withCompactIds)
				const [greaterCollectionPoint,lesserCollectionPoint]=collection.getBoundarySequencePoints()
				if (!greaterCollectionPoint || !lesserCollectionPoint) continue
				if (isGreaterElementSequencePoint(sequencePoint,greaterCollectionPoint)) continue
				if (isGreaterElementSequencePoint(sequencePoint,lesserCollectionPoint)) {
					return {type:'insideRow', $row}
				} else if (isSameMonthTimestamps(sequencePoint.timestamp,lesserCollectionPoint.timestamp)) {
					return {type:'betweenRows', $rowBefore:$row, $rowAfter}
				} else {
					const $separator=this.insertSeparatorRow(sequencePoint,$row)
					return {type:'betweenRows', $rowBefore:$separator, $rowAfter}
				}
			} else {
				const existingSequencePoint=readElementSequencePoint($row)
				if (!existingSequencePoint) continue
				if (!isGreaterElementSequencePoint(existingSequencePoint,sequencePoint)) continue
				if (isSameMonthTimestamps(existingSequencePoint.timestamp,sequencePoint.timestamp)) {
					return {type:'betweenRows', $rowBefore:$row, $rowAfter}
				} else {
					const $separator=this.insertSeparatorRow(sequencePoint,$row)
					return {type:'betweenRows', $rowBefore:$separator, $rowAfter}
				}
			}
		}
		{
			const $rowAfter=this.$gridBody.rows[0]
			const $separator=this.insertSeparatorRow(sequencePoint)
			return {type:'betweenRows', $rowBefore:$separator, $rowAfter}
		}
	}
	private insertSeparatorRow(sequencePoint: ItemSequencePoint, $precedingRow?: HTMLTableRowElement): HTMLTableRowElement {
		const date=new Date(sequencePoint.timestamp)
		const yearMonthString=toIsoYearMonthString(date)
		const $separator=makeElement('tr')('separator')()
		if ($precedingRow) {
			$precedingRow.after($separator)
		} else {
			this.$gridBody.prepend($separator)
		}
		writeSeparatorSequencePoint($separator,date)
		const $cell=$separator.insertCell()
		$cell.append(
			makeDiv('month')(
				makeElement('time')()(yearMonthString)
			)
		)
		$cell.colSpan=this.nColumns+1
		return $separator
	}
	private async toggleItemDisclosureWithButton($disclosureButton: EventTarget|null): Promise<void> {
		if (!($disclosureButton instanceof HTMLButtonElement)) return
		const $item=$disclosureButton.closest('.item')
		if (!($item instanceof HTMLElement)) return
		const itemDescriptor=readItemDescriptor($item)
		if (!itemDescriptor) return
		if (getItemDisclosureButtonState($disclosureButton)) {
			this.collapseItem(itemDescriptor)
		} else {
			$disclosureButton.disabled=true
			await this.expandItem(itemDescriptor)
			$disclosureButton.disabled=false
		}
		const $newItem=$disclosureButton.closest('.item')
		if ($newItem instanceof HTMLElement) {
			$newItem.scrollIntoView({block:'nearest'}) // focusing on button is enough to scroll it in, but it's then too close to the edge
		}
		$disclosureButton.focus()
	}
}

function listItemCopies($itemRow: HTMLTableRowElement, descriptor: ItemDescriptor): [$item:HTMLElement, iColumn:number][] {
	if ($itemRow.classList.contains('item')) {
		return [...$itemRow.cells].flatMap(($cell,iColumn):[$item:HTMLElement,iColumn:number][]=>{
			if ($cell.hasChildNodes()) {
				return [[$cell,iColumn]]
			} else {
				return []
			}
		})
	} else if ($itemRow.classList.contains('collection')) {
		const selector=getItemDescriptorSelector(descriptor)
		return [...$itemRow.cells].flatMap(($cell,iColumn):[$item:HTMLElement,iColumn:number][]=>{
			return [...$cell.querySelectorAll(selector)].map($item=>[$item as HTMLElement,iColumn])
		})
	} else {
		return []
	}
}

function isChangesetOpenedClosedPair($openedItem: HTMLElement, $closedItem: HTMLElement): boolean {
	if ($openedItem.dataset.type!='changeset' || $closedItem.dataset.type!='changesetClose') return false
	return $openedItem.dataset.id==$closedItem.dataset.id
}
function isOpenedClosedPair(a: ItemDescriptor, b: ItemDescriptor): boolean {
	if (a.type!='changeset' || b.type!='changesetClose') return false
	return a.id==b.id
}

function isHiddenItem($item: HTMLElement): boolean {
	return $item.classList.contains('item') && $item.classList.contains('hidden')
}

function isSameMonthTimestamps(t1: number, t2: number): boolean {
	const d1=new Date(t1)
	const d2=new Date(t2)
	return d1.getUTCFullYear()==d2.getFullYear() && d1.getUTCMonth()==d2.getUTCMonth()
}

function setCellHue($cell: HTMLTableCellElement, hue: number|null): void {
	if (hue==null) return
	$cell.style.setProperty('--hue',String(hue))
}

function union<T>(sets: Iterable<Set<T>>): Set<T> {
	return new Set((function*(){
		for (const set of sets) {
			yield *set
		}
	})())
}
