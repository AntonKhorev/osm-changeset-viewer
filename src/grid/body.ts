import type {ServerUrlGetter} from './body-item'
import type {SingleItemDBReader} from '../db'
import type {ItemDescriptor, ItemSequencePoint} from './info'
import {
	readItemDescriptor, getItemDescriptorSelector, isEqualItemDescriptor,
	isGreaterElementSequencePoint, isEqualItemSequencePoint, writeSeparatorSequencePoint, readElementSequencePoint, writeElementSequencePoint,
	getBatchItemSequencePoint, readItemSequencePoint
} from './info'
import {
	getItemCheckbox, getItemDisclosureButton, getItemDisclosureButtonState, setItemDisclosureButtonState,
	makeItemShell, writeCollapsedItemFlow, writeExpandedItemFlow
} from './body-item'
import {getHueFromUid} from './colorizer'
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
	private columnUids: (number|null)[] = []
	constructor(
		private readonly server: ServerUrlGetter,
		private readonly itemReader: SingleItemDBReader
	) {
		this.wrappedItemDisclosureButtonListener=(ev:Event)=>this.toggleItemDisclosureWithButton(ev.currentTarget)
	}
	get nColumns() {
		return this.columnUids.length
	}
	set onItemSelect(callback: ()=>void) {
		this.checkboxHandler.onItemSelect=callback
	}
	setColumns(columnUids: (number|null)[]): void {
		this.columnUids=columnUids
		this.$gridBody.replaceChildren()
		this.checkboxHandler.resetLastClickedCheckbox()
		this.checkboxHandler.onItemSelect()
	}
	addItem(
		batchItem: GridBatchItem,
		usernames: Map<number, string>,
		isExpanded: boolean
	): boolean {
		const sequencePoint=getBatchItemSequencePoint(batchItem)
		if (!sequencePoint) return false
		const $items=batchItem.iColumns.map(()=>{
			const $item=makeItemShell(batchItem,isExpanded,usernames)
			writeElementSequencePoint($item,sequencePoint)
			return $item
		})
		return this.insertItem(
			batchItem.iColumns,sequencePoint,
			!isExpanded?{isExpanded}:{isExpanded,batchItem,usernames},
			$items
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
					$item.hidden=!this.withClosedChangesets
				} else {
					const id=$item.dataset.id??'???'
					if (isConnectedWithLaterItem || !this.withClosedChangesets) {
						if ($laterItem && isConnectedWithLaterItem) {
							$laterItem.hidden=true
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
		let $itemRowAbove: HTMLTableRowElement|undefined
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
				const collection=new EmbeddedItemCollection($row)
				collection.updateIds(this.withCompactIds)
				// spanColumns($row) // TODO need to merge/split collected items in cells
				$itemRowAbove=undefined
			} else if ($row.classList.contains('single')) {
				for (let i=0;i<$row.cells.length;i++) {
					const $cell=$row.cells[i]
					const $item=$cell.querySelector(':scope > .item')
					let $cellAbove: HTMLElement|undefined
					if ($itemRowAbove) {
						$cellAbove=$itemRowAbove.cells[i]
					}
					let $itemAbove: HTMLElement|undefined
					if ($cellAbove) {
						const $itemAboveCandidate=$cellAbove.querySelector(':scope > .item')
						if ($itemAboveCandidate instanceof HTMLElement) {
							$itemAbove=$itemAboveCandidate
						}
					}
					if ($item instanceof HTMLElement) combineChangesets($item,$itemAbove)
				}
				spanColumns($row)
				$itemRowAbove=$row
			} else {
				$itemRowAbove=undefined
			}
		}
	}
	reorderColumns(iShiftFrom: number, iShiftTo: number): void {
		for (const $row of this.$gridBody.rows) {
			if (!$row.classList.contains('single') && !$row.classList.contains('collection')) continue
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
		const collapseRowItems=($row:HTMLTableRowElement)=>{
			const $collection=new EmbeddedItemCollection($row)
			const itemSequence=[...$collection.getItemSequence()]
			if (itemSequence.length==0) return
			const [[sequencePoint,items]]=itemSequence
			const iColumns=items.map(([iColumn])=>iColumn)
			const $items=items.map(([,$item])=>$item)
			const $prevRow=$row.previousElementSibling
			const $nextRow=$row.nextElementSibling
			$row.remove()
			for (const $item of $items) {
				const $disclosureButton=getItemDisclosureButton($item)
				if ($disclosureButton) {
					setItemDisclosureButtonState($disclosureButton,false)
				}
			}
			if (
				$prevRow && $prevRow instanceof HTMLTableRowElement && $prevRow.classList.contains('collection') &&
				$nextRow && $nextRow instanceof HTMLTableRowElement && $nextRow.classList.contains('collection')
			) {
				const collection=new EmbeddedItemCollection($prevRow)
				const nextCollection=new EmbeddedItemCollection($nextRow)
				collection.merge(nextCollection,this.withCompactIds)
			}
			this.insertItem(iColumns,sequencePoint,{isExpanded:false},$items)
		}
		const $rows=this.findRowsMatchingClassAndItemDescriptor('single',descriptor)
		for (const $row of $rows) {
			let $precedingRow=$row.previousElementSibling
			const $precedingHiddenRows:HTMLTableRowElement[]=[]
			while ($precedingRow instanceof HTMLTableRowElement) {
				const $precedingItem=getSingleRowLeadingItem($precedingRow)
				if (!$precedingItem || !isHiddenItem($precedingItem)) break
				$precedingHiddenRows.push($precedingRow)
				$precedingRow=$precedingRow.previousElementSibling
			}
			if ($precedingRow?.classList.contains('collection')) {
				for (const $row of $precedingHiddenRows) {
					collapseRowItems($row)
				}
			} else {
				const $item=getSingleRowLeadingItem($row)
				if ($item && $item.classList.contains('combined')) {
					const $previousRow=$row.previousElementSibling
					if ($previousRow instanceof HTMLTableRowElement) {
						const $previousItem=getSingleRowLeadingItem($previousRow)
						if (
							$previousItem &&
							isHiddenItem($previousItem) &&
							isChangesetOpenedClosedPair($item,$previousItem)
						) {
							collapseRowItems($previousRow)
						}
					}
				}
			}
			let $followingRow=$row.nextElementSibling
			const $followingHiddenRows:HTMLTableRowElement[]=[]
			while ($followingRow instanceof HTMLTableRowElement) {
				const $followingItem=getSingleRowLeadingItem($followingRow)
				if (!$followingItem || !isHiddenItem($followingItem)) break
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
	}
	async expandItem(descriptor: ItemDescriptor): Promise<void> {
		const $rows=this.findRowsMatchingClassAndItemDescriptor('collection',descriptor)
		for (const $row of $rows) {
			const collection=new EmbeddedItemCollection($row)
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
		const $items=items.map(([,$item])=>$item)
		for (const $item of $items) {
			const $disclosureButton=getItemDisclosureButton($item)
			if ($disclosureButton) {
				setItemDisclosureButtonState($disclosureButton,true)
			}
		}
		const collection=new EmbeddedItemCollection($row)
		collection.remove($items,this.withCompactIds)
		const iColumns=items.map(([iColumn])=>iColumn)
		this.insertItem(iColumns,point,{isExpanded:true,batchItem,usernames},$items)
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
		$items: HTMLElement[]
	): boolean {
		if (iColumns.length==0) return false
		this.insertItemElements(iColumns,sequencePoint,insertItemInfo.isExpanded,$items)
		for (const $item of $items) {
			const $flow=$item.querySelector('.flow')
			if (!($flow instanceof HTMLElement)) continue
			$flow.replaceChildren() // TODO don't replaceChildren() in flow writers
			if (insertItemInfo.isExpanded) {
				writeExpandedItemFlow($flow,this.server,insertItemInfo.batchItem,insertItemInfo.usernames)
			} else {
				writeCollapsedItemFlow($flow,this.server,sequencePoint.type,sequencePoint.id)
			}
			const $checkbox=getItemCheckbox($item)
			if ($checkbox) {
				this.checkboxHandler.listen($checkbox)
			}
			const $disclosureButton=getItemDisclosureButton($item)
			$disclosureButton?.addEventListener('click',this.wrappedItemDisclosureButtonListener)
		}
		return true
	}
	private insertItemElements(
		iColumns: number[],
		sequencePoint: ItemSequencePoint,
		isExpanded: boolean,
		$items: HTMLElement[]
	): void {
		const insertionRowInfo=this.findInsertionRow(sequencePoint)
		if (isExpanded) {
			const $row=this.makeRow()
			{
				let $rowBefore:HTMLTableRowElement
				if (insertionRowInfo.type=='betweenRows') {
					$rowBefore=insertionRowInfo.$rowBefore
				} else {
					$rowBefore=insertionRowInfo.$row
					const collection=new EmbeddedItemCollection($rowBefore)
					collection.split(sequencePoint,this.withCompactIds)
				}
				$rowBefore.after($row)
			}
			$row.classList.add('single')
			updateTimelineOnInsert($row,iColumns)
			for (const [iItem,iColumn] of iColumns.entries()) {
				const $cell=$row.cells[iColumn+1]
				const $item=$items[iItem]
				$cell.append($item)
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
			const collection=new EmbeddedItemCollection($row)
			collection.insert(sequencePoint,iColumns,$items,this.withCompactIds)
		}
	}
	private makeRow(): HTMLTableRowElement {
		const $row=makeElement('tr')()()
		$row.insertCell()
		for (const uid of this.columnUids) {
			const $cell=$row.insertCell()
			if (uid!=null) {
				const hue=getHueFromUid(uid)
				$cell.style.setProperty('--hue',String(hue))
			}
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
			if (
				$row.classList.contains('single') ||
				$row.classList.contains('collection')
			) {
				const collection=new EmbeddedItemCollection($row)
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
		$cell.colSpan=this.nColumns+2
		return $separator
	}
	private findRowsMatchingClassAndItemDescriptor(className: string, descriptor: ItemDescriptor): Iterable<HTMLTableRowElement> {
		const itemSelector=getItemDescriptorSelector(descriptor)
		const itemSelectorWithRow=`tr.${className} ${itemSelector}`
		const $items=this.$gridBody.querySelectorAll(itemSelectorWithRow)
		const $rows=new Set<HTMLTableRowElement>()
		for (const $item of $items) {
			const $row=$item.closest('tr')
			if (!$row) continue
			$rows.add($row)
		}
		return $rows
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

function getSingleRowLeadingItem($row: HTMLTableRowElement): HTMLElement|null {
	const $collection=new EmbeddedItemCollection($row)
	const itemSequence=[...$collection.getItemSequence()]
	if (itemSequence.length==0) return null
	const [[,items]]=itemSequence
	if (items.length==0) return null
	const [[,$item]]=items
	return $item
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
	return $item.classList.contains('item') && $item.hidden
}

function isSameMonthTimestamps(t1: number, t2: number): boolean {
	const d1=new Date(t1)
	const d2=new Date(t2)
	return d1.getUTCFullYear()==d2.getUTCFullYear() && d1.getUTCMonth()==d2.getUTCMonth()
}

function union<T>(sets: Iterable<Set<T>>): Set<T> {
	return new Set((function*(){
		for (const set of sets) {
			yield *set
		}
	})())
}
