import type {ServerUrlGetter} from './body-item'
import type {SingleItemDBReader} from '../db'
import type {ItemDescriptor, ItemSequencePoint} from './info'
import {
	readItemDescriptor, getItemDescriptorSelector,
	isGreaterElementSequencePoint, writeSeparatorSequencePoint, readElementSequencePoint, writeElementSequencePoint,
	getBatchItemSequencePoint, readItemSequencePoint
} from './info'
import {
	getItemCheckbox, getItemDisclosureButton, getItemDisclosureButtonState, setItemDisclosureButtonState,
	markChangesetItemAsCombined, markChangesetItemAsUncombined,
	makeItemShell, writeCollapsedItemFlow, writeExpandedItemFlow, makeCollectionIcon
} from './body-item'
import GridBodyCollectionRow from './collection'
import {updateTimelineOnInsert} from './timeline'
import * as bodyItemSet from './body-item-set'
import type {GridBatchItem} from '../mux-user-item-db-stream-messenger'
import type {MuxBatchItem} from '../mux-user-item-db-stream'
import {toIsoYearMonthString} from '../date'
import {makeElement, makeDiv} from '../util/html'
import {moveInArray} from '../util/types'

type GridPosition = {
	type: 'afterRow'
	$row: HTMLTableRowElement
} | {
	type: 'insideRow'
	$row: HTMLTableRowElement
	$items: (HTMLElement|null)[]
}

export default class GridBody {
	readonly $gridBody=makeElement('tbody')()()
	onItemSelect: ()=>void = ()=>{}
	private readonly wrappedItemSelectListener: ()=>void
	private readonly wrappedItemDisclosureButtonListener: (ev:Event)=>void
	private columnTimelineCutoffSequenceInfo: (ItemSequencePoint|null)[] = [] // TODO remove it
	constructor(
		private readonly server: ServerUrlGetter,
		private readonly itemReader: SingleItemDBReader,
		private readonly getColumnHues: ()=>(number|null)[]
	) {
		this.wrappedItemSelectListener=()=>this.onItemSelect()
		this.wrappedItemDisclosureButtonListener=(ev:Event)=>this.toggleItemDisclosureWithButton(ev.currentTarget)
	}
	get nColumns(): number {
		return this.columnTimelineCutoffSequenceInfo.length
	}
	setColumns(nColumns: number): void {
		this.columnTimelineCutoffSequenceInfo=new Array<ItemSequencePoint|null>(nColumns).fill(null)
		this.$gridBody.replaceChildren()
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
	updateTableAccordingToSettings(inOneColumn: boolean, withClosedChangesets: boolean): void {
		const combineChangesets=($item: HTMLElement, $laterItem: HTMLElement|undefined)=>{
			const isConnectedWithLaterItem=(
				$laterItem &&
				$laterItem.classList.contains('changeset') &&
				$laterItem.classList.contains('closed') &&
				$item.dataset.id==$laterItem.dataset.id
			)
			if ($item.classList.contains('changeset')) {
				if ($item.classList.contains('closed')) {
					$item.classList.toggle('hidden',!withClosedChangesets)
				} else {
					if (isConnectedWithLaterItem || !withClosedChangesets) {
						if ($laterItem && isConnectedWithLaterItem) {
							$laterItem.classList.add('hidden')
						}
						markChangesetItemAsCombined($item,$item.dataset.id??'???')
					} else {
						markChangesetItemAsUncombined($item,$item.dataset.id??'???')
					}
				}
			}
		}
		const spanColumns=($row:HTMLTableRowElement)=>{
			let spanned=false
			for (const $cell of $row.cells) {
				if (inOneColumn) {
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
		moveInArray(this.columnTimelineCutoffSequenceInfo,iShiftFrom,iShiftTo)
		for (const $row of this.$gridBody.rows) {
			if (!$row.classList.contains('item')) continue
			const $cells=[...$row.cells]
			moveInArray($cells,iShiftFrom,iShiftTo)
			$row.replaceChildren(...$cells)
		}
	}
	getColumnCheckboxStatuses(): [
		hasChecked: boolean[],
		hasUnchecked: boolean[]
	] {
		const hasChecked=this.columnTimelineCutoffSequenceInfo.map(()=>false)
		const hasUnchecked=this.columnTimelineCutoffSequenceInfo.map(()=>false)
		for (const $row of this.$gridBody.rows) {
			if (!$row.classList.contains('collection') && !$row.classList.contains('changeset')) continue
			for (const [iColumn,$cell] of [...$row.cells].entries()) {
				for (const $checkbox of listCellCheckboxes($cell,$row.classList.contains('collection'))) {
					hasChecked[iColumn]||=$checkbox.checked
					hasUnchecked[iColumn]||=!$checkbox.checked
				}
			}
		}
		return [hasChecked,hasUnchecked]
	}
	triggerColumnCheckboxes(iColumn: number, isChecked: boolean): void {
		for (const $row of this.$gridBody.rows) {
			if (!$row.classList.contains('collection') && !$row.classList.contains('changeset')) continue
			const $cell=$row.cells[iColumn]
			if (!$cell) continue
			for (const $checkbox of listCellCheckboxes($cell,$row.classList.contains('collection'))) {
				$checkbox.checked=isChecked
				syncColumnCheckboxes($checkbox)
			}
		}
		this.onItemSelect()
	}
	*listSelectedItemDescriptors(): Iterable<ItemDescriptor> {
		for (const $item of this.$gridBody.querySelectorAll(`.item`)) {
			if (!($item instanceof HTMLElement)) continue
			if (!$item.querySelector(`input[type=checkbox]:checked`)) continue
			const itemDescriptor=readItemDescriptor($item)
			if (!itemDescriptor) continue
			yield itemDescriptor
		}
	}
	collapseItem(descriptor: ItemDescriptor): void {
		const itemSelectorWithRow='tr'+getItemDescriptorSelector(descriptor)
		const $row=this.$gridBody.querySelector(itemSelectorWithRow) // TODO select all matching rows? but there can't be more than one
		if (!($row instanceof HTMLTableRowElement)) return
		const collapseRowItems=($row:HTMLTableRowElement,continueTimeline=false)=>{
			const sequencePoint=readItemSequencePoint($row)
			if (!sequencePoint) return
			const itemCopies=listItemCopies($row,sequencePoint)
			const iColumns=itemCopies.map(([,iColumn])=>iColumn)
			const $placeholders=itemCopies.map(([$item])=>$item)
			const classNames=[...$row.classList]
			const $prevRow=$row.previousElementSibling
			const $nextRow=$row.nextElementSibling
			if (continueTimeline) {
				for (const iColumn of iColumns) {
					this.columnTimelineCutoffSequenceInfo[iColumn]=null // TODO shouldn't change?
				}
			}
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
				mergeCollectionRows($prevRow,$nextRow)
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
		collapseRowItems($row,descriptor.type=='user')
	}
	async expandItem(descriptor: ItemDescriptor): Promise<void> {
		const makeUsernames=(uid?:number,username?:string)=>{
			if (uid==null || username==null) {
				return new Map<number,string>()
			} else {
				return new Map<number,string>([[uid,username]])
			}
		}
		const expandItemSet=async(iColumns:number[],$placeholders:HTMLElement[],continueTimeline=false)=>{
			const [$item]=$placeholders
			const $row=$item.closest('tr')
			if (!$row) return
			const sequencePoint=readItemSequencePoint($item)
			if (!sequencePoint) return
			let batchItem:MuxBatchItem
			let usernames:Map<number,string>
			if (sequencePoint.type=='user') {
				const item=await this.itemReader.getUser(sequencePoint.id)
				if (!item || !item.withDetails || !item.visible) return
				batchItem={type:sequencePoint.type,item}
				usernames=makeUsernames()
			} else if (sequencePoint.type=='changeset' || sequencePoint.type=='changesetClose') {
				const item=await this.itemReader.getChangeset(sequencePoint.id)
				if (!item) return
				batchItem={type:sequencePoint.type,item}
				usernames=makeUsernames()
			} else if (sequencePoint.type=='note') {
				const item=await this.itemReader.getNote(sequencePoint.id)
				if (!item) return
				batchItem={type:sequencePoint.type,item}
				usernames=makeUsernames()
			} else if (sequencePoint.type=='changesetComment') {
				const {comment,username}=await this.itemReader.getChangesetComment(sequencePoint.id,sequencePoint.order??0)
				if (!comment) return
				batchItem={type:sequencePoint.type,item:comment}
				usernames=makeUsernames(comment.uid,username)
			} else if (sequencePoint.type=='noteComment') {
				const {comment,username}=await this.itemReader.getNoteComment(sequencePoint.id,sequencePoint.order??0)
				if (!comment) return
				batchItem={type:sequencePoint.type,item:comment}
				usernames=makeUsernames(comment.uid,username)
			} else {
				return
			}
			const classNames=[...$item.classList]
			for (const $placeholder of $placeholders) {
				const $disclosureButton=getItemDisclosureButton($placeholder)
				if ($disclosureButton) {
					setItemDisclosureButtonState($disclosureButton,true)
				}
				$placeholder.remove()
			}
			if (continueTimeline) {
				for (const iColumn of iColumns) {
					this.columnTimelineCutoffSequenceInfo[iColumn]=null // TODO shouldn't change?
				}
			}
			if (!doesCollectionRowHaveItems($row)) {
				$row.remove()
			}
			this.insertItem(iColumns,sequencePoint,{isExpanded:true,batchItem,usernames},$placeholders,classNames)
		}
		const findPrecedingItemSetsToExpand=($startingItemSet:HTMLElement[])=>{
			const [$startingItem]=$startingItemSet
			let $precedingItemSet=bodyItemSet.getPreviousSibling($startingItemSet)
			const $precedingHiddenItemSets:HTMLElement[][]=[]
			while ($precedingItemSet) {
				if (!isHiddenItemSet($precedingItemSet)) break
				$precedingHiddenItemSets.unshift($precedingItemSet) // top-to-bottom order of expandItemSet() calls
				$precedingItemSet=bodyItemSet.getPreviousSibling($precedingItemSet)
			}
			if (
				$precedingHiddenItemSets.length>0 &&
				bodyItemSet.areSame(
					$precedingHiddenItemSets[0],
					bodyItemSet.getFirstSibling($startingItemSet)??[]
				)
			) {
				return $precedingHiddenItemSets
			} else if ($startingItem.classList.contains('combined')) {
				const $previousItemSet=bodyItemSet.getPreviousSibling($startingItemSet)
				if ($previousItemSet) {
					const [$previousItem]=$previousItemSet
					if (isHiddenItem($previousItem) && isChangesetOpenedClosedPair($startingItem,$previousItem)) {
						return [$previousItemSet]
					}
				}
			}
			return []
		}
		const findFollowingItemsToExpand=($startingItemSet:HTMLElement[])=>{
			let $followingItemSet=bodyItemSet.getNextSibling($startingItemSet)
			const $followingHiddenItemSets:HTMLElement[][]=[]
			while ($followingItemSet) {
				if (!isHiddenItemSet($followingItemSet)) break
				$followingHiddenItemSets.push($followingItemSet)
				$followingItemSet=bodyItemSet.getNextSibling($followingItemSet)
			}
			if (
				$followingHiddenItemSets.length>0 &&
				bodyItemSet.areSame(
					$followingHiddenItemSets[$followingHiddenItemSets.length-1],
					bodyItemSet.getLastSibling($startingItemSet)??[]
				)
			) {
				return $followingHiddenItemSets
			}
			return []
		}
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
			const uniqueItemCopies=new Map<number,HTMLElement>()
			for (const [$item,iColumn] of listItemCopies($row,descriptor)) {
				if (uniqueItemCopies.has(iColumn)) {
					$item.remove()
				} else {
					uniqueItemCopies.set(iColumn,$item)
				}
			}
			if (uniqueItemCopies.size==0) continue
			const iColumns=[...uniqueItemCopies.keys()]
			const $startingItemSet=[...uniqueItemCopies.values()]
			const $precedingItemSetsToExpand=findPrecedingItemSetsToExpand($startingItemSet)
			const $followingItemSetsToExpand=findFollowingItemsToExpand($startingItemSet)
			for (const $itemSet of $precedingItemSetsToExpand) {
				await expandItemSet(iColumns,$itemSet)
			}
			await expandItemSet(iColumns,$startingItemSet,descriptor.type=='user')
			for (const $itemSet of $followingItemSetsToExpand) {
				await expandItemSet(iColumns,$itemSet)
			}
		}
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
		if (sequencePoint.type=='user') { // TODO remove this
			for (const iColumn of iColumns) {
				this.columnTimelineCutoffSequenceInfo[iColumn]=sequencePoint
			}
		}
		const $placeholders=this.insertItemPlaceholders(iColumns,sequencePoint,insertItemInfo.isExpanded,$previousPlaceholders,classNames)
		const $checkboxes:HTMLInputElement[]=[]
		for (const $placeholder of $placeholders) {
			const $flow=$placeholder.querySelector('.flow')
			if (!($flow instanceof HTMLElement)) continue
			if (insertItemInfo.isExpanded) {
				writeExpandedItemFlow($flow,this.server,insertItemInfo.batchItem,insertItemInfo.usernames)
			} else {
				writeCollapsedItemFlow($flow,this.server,sequencePoint.type,sequencePoint.id)
			}
			const $checkbox=getItemCheckbox($placeholder)
			if ($checkbox) $checkboxes.push($checkbox)
			const $disclosureButton=getItemDisclosureButton($placeholder)
			$disclosureButton?.addEventListener('click',this.wrappedItemDisclosureButtonListener)
		}
		for (const $checkbox of $checkboxes) {
			if ($checkboxes.length>1) {
				$checkbox.addEventListener('input',columnCheckboxSyncListener)
			}
			$checkbox.addEventListener('input',this.wrappedItemSelectListener)
		}
		return true
	}
	// { rewrite
	private insertItemPlaceholders(
		iColumns: number[],
		sequencePoint: ItemSequencePoint,
		isExpanded: boolean,
		$previousPlaceholders: HTMLElement[],
		classNames: string[]
	): HTMLElement[] {
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
					const collection=new GridBodyCollectionRow(insertionRowInfo.$row)
					const $rowAfter=collection.split(sequencePoint)
					$rowBefore=insertionRowInfo.$row
					$rowBefore.after($rowAfter)
				}
				$rowBefore.after($row)
			}
			$row.classList.add(...classNames)
			writeElementSequencePoint($row,sequencePoint)
			updateTimelineOnInsert($row,iColumns)
			return iColumns.map((iColumn,iPlaceholder)=>{
				const $placeholder=$row.cells[iColumn]
				copyPlaceholderChildren($placeholder,iPlaceholder)
				return $placeholder
			})
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
			const collection=new GridBodyCollectionRow($row)
			const $placeholders=collection.insert(sequencePoint,iColumns)
			for (const [iPlaceholder,$placeholder] of $placeholders.entries()) {
				$placeholder.classList.add(...classNames)
				copyPlaceholderChildren($placeholder,iPlaceholder)
			}
			return $placeholders
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
				const collection=new GridBodyCollectionRow($row)
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
	/*
	private insertItemPlaceholders(
		iColumns: number[],
		sequenceInfo: ItemSequenceInfo,
		isExpanded: boolean,
		$previousPlaceholders: HTMLElement[],
		classNames: string[]
	): HTMLElement[] {
		let position=this.getGridPositionAndInsertSeparatorIfNeeded(sequenceInfo)
		let $row:HTMLTableRowElement
		if (!isExpanded && position.type=='insideRow') {
			$row=position.$row
		} else {
			$row=this.insertRow(position)
			const columnHues=this.getColumnHues()
			for (const [iColumn,reached] of this.hasColumnReachedTimelineEnd.entries()) {
				const $cell=$row.insertCell()
				$cell.classList.toggle('with-timeline-above',!reached)
				$cell.classList.toggle('with-timeline-below',!reached)
				setCellHue($cell,columnHues[iColumn])
			}
		}
		if (sequenceInfo.type=='user') {
			const iColumnSet=new Set(iColumns)
			for (const iColumn of iColumns) {
				this.hasColumnReachedTimelineEnd[iColumn]=true
				$row.cells[iColumn].classList.toggle('with-timeline-below',false)
			}
			for (let $followingRow=$row.nextElementSibling;$followingRow;$followingRow=$followingRow.nextElementSibling) {
				if (!($followingRow instanceof HTMLTableRowElement)) continue
				if (!(
					$followingRow.classList.contains('item') ||
					$followingRow.classList.contains('collection')
				)) continue
				for (const [iColumn,$cell] of [...$followingRow.cells].entries()) {
					if (!iColumnSet.has(iColumn)) continue
					$cell.classList.remove('with-timeline-above','with-timeline-below')
				}
			}
		}
		const copyPlaceholderChildren=($placeholder:HTMLElement,iPlaceholder:number)=>{
			$placeholder.replaceChildren(
				...$previousPlaceholders[iPlaceholder].childNodes
			)
		}
		if (isExpanded) {
			$row.classList.add(...classNames)
			writeElementSequenceInfo($row,sequenceInfo)
			return iColumns.map((iColumn,iPlaceholder)=>{
				const $placeholder=$row.cells[iColumn]
				copyPlaceholderChildren($placeholder,iPlaceholder)
				return $placeholder
			})
		} else {
			$row.classList.add('collection')
			const $placeholders:HTMLElement[]=[]
			for (const [iPlaceholder,iColumn] of iColumns.entries()) {
				const $placeholder=makeElement('span')(...classNames)()
				writeElementSequenceInfo($placeholder,sequenceInfo)
				copyPlaceholderChildren($placeholder,iPlaceholder)
				const $cell=$row.cells[iColumn]
				const cellWasEmpty=$cell.childElementCount==0
				if (position.type=='insideRow') {
					const $precedingItem=position.$items[iColumn]
					if ($precedingItem==null) {
						insertPlaceholderBeforeFirstCellItem($placeholder,$cell)
					} else {
						$precedingItem.after($placeholder)
					}
				} else {
					$cell.append($placeholder)
				}
				if (cellWasEmpty && $cell.childElementCount>0) {
					$cell.prepend(makeCollectionIcon())
				}
				$placeholders.push($placeholder)
			}
			return $placeholders
		}
	}
	private getGridPositionAndInsertSeparatorIfNeeded(sequenceInfo: ItemSequenceInfo): GridPosition {
		const insertSeparatorRow=($precedingRow?:HTMLTableRowElement)=>{
			const date=new Date(sequenceInfo.timestamp)
			const yearMonthString=toIsoYearMonthString(date)
			const $separator=makeElement('tr')('separator')()
			if ($precedingRow) {
				$precedingRow.after($separator)
			} else {
				this.$gridBody.prepend($separator)
			}
			writeSeparatorSequenceInfo($separator,date)
			const $cell=$separator.insertCell()
			$cell.append(
				makeDiv('month')(
					makeElement('time')()(yearMonthString)
				)
			)
			$cell.colSpan=this.nColumns+1
			return $separator
		}
		let $followingSameMonthCollectionRow:HTMLTableRowElement|undefined
		for (let i=this.$gridBody.rows.length-1;i>=0;i--) {
			const $row=this.$gridBody.rows[i]
			if ($row.classList.contains('collection')) {
				let isSameMonthRow=true
				const $items=[...$row.cells].map(($cell:HTMLTableCellElement)=>{
					const $items=$cell.querySelectorAll(':scope > .item')
					for (let i=$items.length-1;i>=0;i--) {
						const $item=$items[i]
						if (!($item instanceof HTMLElement)) continue
						const precedingSequenceInfo=readElementSequenceInfo($item)
						if (!precedingSequenceInfo) continue
						if (!isSameMonthTimestamps(precedingSequenceInfo.timestamp,sequenceInfo.timestamp)) {
							isSameMonthRow=false
						}
						if (isGreaterElementSequenceInfo(precedingSequenceInfo,sequenceInfo)) {
							return $item
						}
					}
					return null
				})
				if ($items.some($item=>$item!=null)) {
					if (isSameMonthRow) {
						return {
							type: 'insideRow',
							$row,
							$items
						}
					} else {
						return {
							type: 'afterRow',
							$row: insertSeparatorRow($row)
						}
					}
				} else {
					if (isSameMonthRow) {
						$followingSameMonthCollectionRow=$row
					} else {
						$followingSameMonthCollectionRow=undefined
					}
				}
			} else {
				const precedingSequenceInfo=readElementSequenceInfo($row)
				if (!precedingSequenceInfo) continue
				if (isGreaterElementSequenceInfo(precedingSequenceInfo,sequenceInfo)) {
					if (!isSameMonthTimestamps(precedingSequenceInfo.timestamp,sequenceInfo.timestamp)) {
						return {
							type: 'afterRow',
							$row: insertSeparatorRow($row)
						}
					} else if ($followingSameMonthCollectionRow) {
						return {
							type: 'insideRow',
							$row: $followingSameMonthCollectionRow,
							$items: [...$followingSameMonthCollectionRow.cells].map(_=>null)
						}
					} else {
						return {
							type: 'afterRow',
							$row
						}
					}
				} else {
					$followingSameMonthCollectionRow=undefined
				}
			}
		}
		return {
			type: 'afterRow',
			$row: insertSeparatorRow()
		}
	}
	private insertRow(position: GridPosition): HTMLTableRowElement {
		const $row=makeElement('tr')()()
		if (position.type=='afterRow') {
			position.$row.after($row)
		} else if (position.type=='insideRow') {
			if (position.$items.every($item=>$item==null)) {
				position.$row.before($row)
			} else {
				position.$row.after($row)
				const $cellChildrenAfterInColumns=position.$items.map($precedingItem=>{
					if (!$precedingItem) return []
					const $cellChildrenAfter:Element[]=[]
					let $child:Element|null=$precedingItem
					while ($child=$child?.nextElementSibling) {
						$cellChildrenAfter.push($child)
					}
					return $cellChildrenAfter
				})
				if ($cellChildrenAfterInColumns.some($cellChildrenAfter=>$cellChildrenAfter.length>0)) {
					const columnHues=this.getColumnHues()
					const $rowAfter=makeElement('tr')('collection')()
					for (const [iColumn,$cellChildrenAfter] of $cellChildrenAfterInColumns.entries()) {
						const $cellBefore=position.$row.cells[iColumn]
						const $cellAfter=$rowAfter.insertCell()
						$cellAfter.classList.add('with-timeline-above')
						if ($cellBefore.classList.contains('with-timeline-below')) {
							$cellAfter.classList.add('with-timeline-below')
						} else {
							$cellBefore.classList.add('with-timeline-below')
						}
						$cellAfter.append(...$cellChildrenAfter)
						setCellHue($cellAfter,columnHues[iColumn])
					}
					$row.after($rowAfter)
				}
			}
		}
		return $row
	}
	*/
	// } rewrite
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
	}
}

function columnCheckboxSyncListener(this: HTMLInputElement): void {
	syncColumnCheckboxes(this)
}

function *listCellCheckboxes($cell: HTMLTableCellElement, isCollection: boolean): Iterable<HTMLInputElement> {
	if (isCollection) {
		for (const $changeset of $cell.querySelectorAll(':scope > .changeset')) {
			if (!($changeset instanceof HTMLElement)) continue
			const $checkbox=getItemCheckbox($changeset)
			if ($checkbox) yield $checkbox
		}
	} else {
		const $checkbox=getItemCheckbox($cell)
		if ($checkbox) yield $checkbox
	}
}

function syncColumnCheckboxes($checkbox: HTMLInputElement): void {
	const $itemRow=$checkbox.closest('tr')
	if (!$itemRow) return
	const $item=$checkbox.closest('.item')
	if (!($item instanceof HTMLElement)) return
	const descriptor=readItemDescriptor($item)
	if (!descriptor) return
	for (const [$itemCopy] of listItemCopies($itemRow,descriptor)) {
		const $checkboxCopy=getItemCheckbox($itemCopy)
		if (!$checkboxCopy) continue
		$checkboxCopy.checked=$checkbox.checked
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

function isHiddenItem($item: HTMLElement): boolean {
	return $item.classList.contains('item') && $item.classList.contains('hidden')
}

function isHiddenItemSet($items: HTMLElement[]): boolean {
	return $items.every(isHiddenItem)
}

function isSameMonthTimestamps(t1: number, t2: number): boolean {
	const d1=new Date(t1)
	const d2=new Date(t2)
	return d1.getUTCFullYear()==d2.getFullYear() && d1.getUTCMonth()==d2.getUTCMonth()
}

function insertPlaceholderBeforeFirstCellItem($placeholder: HTMLElement, $cell: HTMLTableCellElement): void {
	let $child=$cell.firstElementChild
	while ($child) {
		if ($child.classList.contains('item')) {
			$child.before($placeholder)
			return
		}
		$child=$child.nextElementSibling
	}
	$cell.append($placeholder)
}

function doesCollectionRowHaveItems($row: HTMLTableRowElement): boolean {
	return [...$row.cells].some($cell=>$cell.querySelector(':scope > .item'))
}

function mergeCollectionRows($row1: HTMLTableRowElement, $row2: HTMLTableRowElement): void {
	const $cells1=[...$row1.cells]
	const $cells2=[...$row2.cells]
	for (let i=0;i<$cells1.length&&i<$cells2.length;i++) {
		const $cell1=$cells1[i]
		const $cell2=$cells2[i]
		if (!$cell2) continue
		if (!$cell1) {
			$row1.append($cell2)
			continue
		}
		let copying=false
		for (const $child of [...$cell2.children]) {
			if ($child.classList.contains('item')) {
				copying=true
			}
			if (copying) {
				$cell1.append($child)
			}
		}
	}
	$row2.remove()
}

function setCellHue($cell: HTMLTableCellElement, hue: number|null): void {
	if (hue==null) return
	$cell.style.setProperty('--hue',String(hue))
}
