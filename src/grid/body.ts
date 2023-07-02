import type {ServerUrlGetter} from './body-item'
import type {SingleItemDBReader} from '../db'
import type {ItemDescriptor, ItemSequencePoint} from './info'
import {
	readItemDescriptor, getItemDescriptorSelector, getBroadItemDescriptorSelector, isEqualItemDescriptor,
	isGreaterElementSequencePoint, writeSeparatorSequencePoint, readElementSequencePoint, writeElementSequencePoint,
	getBatchItemSequencePoint
} from './info'
import {
	getItemCheckbox, getItemDisclosureButton, getItemDisclosureButtonState, setItemDisclosureButtonState,
	makeItemShell, writeExpandedItemFlow, trimToCollapsedItemFlow
} from './body-item'
import {getHueFromUid} from './colorizer'
import EmbeddedItemRow from './embedded-row'
import {updateTimelineOnInsert} from './timeline'
import GridBodyCheckboxHandler from './body-checkbox'
import ItemOptions from './item-options'
import type {GridBatchItem} from '../mux-user-item-db-stream-messenger'
import type {MuxBatchItem} from '../mux-user-item-db-stream'
import {toIsoYearMonthString} from '../date'
import {makeElement, makeDiv} from '../util/html'

export default class GridBody {
	readonly $gridBody=makeElement('tbody')()()
	withCompactIds=false
	withClosedChangesets=false
	expandedItemOptions=new ItemOptions(true)
	collapsedItemOptions=new ItemOptions(false)
	private checkboxHandler=new GridBodyCheckboxHandler(this.$gridBody)
	private columnUids: (number|null)[] = []
	constructor(
		private readonly server: ServerUrlGetter,
		private readonly itemReader: SingleItemDBReader
	) {
		this.$gridBody.addEventListener('click',ev=>{
			if (!(ev.target instanceof Element)) return
			const $button=ev.target.closest('button')
			if ($button) {
				if ($button.classList.contains('disclosure')) {
					this.toggleItemDisclosureWithButton($button)
				} else if ($button.classList.contains('stretch')) {
					this.toggleRowStretchWithButton($button)
				}
				return
			}
			const $item=ev.target.closest('.item')
			if ($item instanceof HTMLElement) {
				this.highlightClickedItem($item)
				return
			}
		})
		this.$gridBody.addEventListener('mousemove',ev=>{
			if (!(ev.target instanceof Element)) return
			const $item=ev.target.closest('.item')
			if (!($item instanceof HTMLElement)) return
			if ($item.classList.contains('highlighted-by-click-and-fading')) {
				this.highlightClickedItem($item)
			}
		})
		this.$gridBody.addEventListener('transitionend',ev=>{
			if (!(ev.target instanceof HTMLElement)) return
			const $item=ev.target.closest('.item')
			if (!($item instanceof HTMLElement)) return
			this.unhighlightClickedItem($item)
		})
		this.$gridBody.addEventListener('mouseenter',ev=>{
			if (!(ev.target instanceof HTMLElement)) return
			const $item=ev.target
			if (!$item.matches('.item')) return
			const descriptor=readItemDescriptor($item)
			if (!descriptor) return
			this.highlightHoveredItemDescriptor(descriptor)
		},true)
		this.$gridBody.addEventListener('mouseleave',ev=>{
			if (!(ev.target instanceof HTMLElement)) return
			const $item=ev.target
			if (!$item.matches('.item')) return
			const descriptor=readItemDescriptor($item)
			if (!descriptor) return
			this.unhighlightHoveredItemDescriptor(descriptor)
		},true)
	}
	get nColumns() {
		return this.columnUids.length
	}
	get withTotalColumn(): boolean {
		return this.nColumns>=2
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
		const $item=makeItemShell(batchItem,isExpanded,usernames)
		writeElementSequencePoint($item,sequencePoint)
		const $flow=$item.querySelector('.flow')
		if (!($flow instanceof HTMLElement)) return false
		writeExpandedItemFlow($flow,this.server,batchItem,usernames,this.expandedItemOptions)
		const $items=batchItem.iColumns.map(()=>$item.cloneNode(true) as HTMLElement)
		return this.insertItem(
			batchItem.iColumns,sequencePoint,
			!isExpanded?{isExpanded}:{isExpanded,batchItem,usernames},
			$items
		)
	}
	stretchAllItems(): void {
		for (const $row of this.$gridBody.rows) {
			if (!EmbeddedItemRow.isItemRow($row)) continue
			const row=new EmbeddedItemRow($row)
			row.stretch(this.withCompactIds)
		}
	}
	shrinkAllItems(): void {
		for (const $row of this.$gridBody.rows) {
			if (!EmbeddedItemRow.isItemRow($row)) continue
			const row=new EmbeddedItemRow($row)
			row.shrink(this.withCompactIds)
		}
	}
	updateTableAccordingToSettings(): void {
		const setCheckboxTitle=($item: HTMLElement, title: string)=>{
			const $checkbox=getItemCheckbox($item)
			if ($checkbox) $checkbox.title=title
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
						setCheckboxTitle($item,`changeset ${id}`)
					} else {
						$item.classList.remove('combined')
						setCheckboxTitle($item,`opened changeset ${id}`)
					}
				}
			}
		}
		let $itemRowAbove: HTMLTableRowElement|undefined
		for (const $row of this.$gridBody.rows) {
			if ($row.classList.contains('collection')) {
				for (const $cell of $row.cells) {
					let $laterItem: HTMLElement|undefined
					for (const $item of $cell.querySelectorAll(':scope > * > .item')) {
						if (!($item instanceof HTMLElement)) continue
						combineChangesets($item,$laterItem)
						$laterItem=$item
					}
				}
				const row=new EmbeddedItemRow($row)
				row.updateIds(this.withCompactIds)
				$itemRowAbove=undefined
			} else if ($row.classList.contains('single')) {
				for (let i=0;i<$row.cells.length;i++) {
					const $cell=$row.cells[i]
					const $item=$cell.querySelector(':scope > * > .item')
					let $cellAbove: HTMLElement|undefined
					if ($itemRowAbove) {
						$cellAbove=$itemRowAbove.cells[i]
					}
					let $itemAbove: HTMLElement|undefined
					if ($cellAbove) {
						const $itemAboveCandidate=$cellAbove.querySelector(':scope > * > .item')
						if ($itemAboveCandidate instanceof HTMLElement) {
							$itemAbove=$itemAboveCandidate
						}
					}
					if ($item instanceof HTMLElement) combineChangesets($item,$itemAbove)
				}
				$itemRowAbove=$row
			} else {
				$itemRowAbove=undefined
			}
		}
		for (const $row of this.$gridBody.rows) {
			if (!EmbeddedItemRow.isItemRow($row)) continue
			new EmbeddedItemRow($row).updateStretchButtonHiddenState()
		}
		this.updateTableAccordingToExpandedItemOptions()
		this.updateTableAccordingToCollapsedItemOptions()
	}
	updateTableAccordingToExpandedItemOptions(): void {
		this.updateTableAccordingToItemOptions(this.expandedItemOptions,'single')
	}
	updateTableAccordingToCollapsedItemOptions(): void {
		this.updateTableAccordingToItemOptions(this.collapsedItemOptions,'collection')
	}
	private updateTableAccordingToItemOptions(itemOptions: ItemOptions, rowClass: string): void {
		for (const {get,name} of itemOptions.list) {
			for (const $piece of this.$gridBody.querySelectorAll(
				`:scope > tr.${rowClass} .item .balloon .flow [data-optional="${name}"]`
			)) {
				if (!($piece instanceof HTMLElement)) continue
				$piece.hidden=!get()
			}
		}
	}
	reorderColumns(iShiftFrom: number, iShiftTo: number): void {
		for (const $row of this.$gridBody.rows) {
			if (!EmbeddedItemRow.isItemRow($row)) continue
			new EmbeddedItemRow($row).reorderColumns(iShiftFrom,iShiftTo)
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
			const row=new EmbeddedItemRow($row)
			const itemSequence=[...row.getItemSequence()]
			if (itemSequence.length==0) return
			const [[sequencePoint,items]]=itemSequence
			const iColumns=items.map(([iColumn])=>iColumn)
			const $items=items.map(([,$item])=>$item)
			row.cut(this.withCompactIds)
			for (const $item of $items) {
				const $disclosureButton=getItemDisclosureButton($item)
				if ($disclosureButton) {
					setItemDisclosureButtonState($disclosureButton,false)
				}
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
			const row=new EmbeddedItemRow($row)
			const itemSequence=[...row.getItemSequence()]
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
		const row=new EmbeddedItemRow($row)
		row.remove($items,this.withCompactIds)
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
			if (insertItemInfo.isExpanded) {
				$flow.replaceChildren() // TODO don't replaceChildren() in flow writers
				writeExpandedItemFlow($flow,this.server,insertItemInfo.batchItem,insertItemInfo.usernames,this.expandedItemOptions)
			} else {
				trimToCollapsedItemFlow($flow,this.collapsedItemOptions)
			}
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
			let needStretch=false
			const $row=makeElement('tr')()()
			if (insertionRowInfo.type=='betweenRows') {
				insertionRowInfo.$rowBefore.after($row)
				if (
					EmbeddedItemRow.isItemRow(insertionRowInfo.$rowBefore)
				) {
					needStretch||=new EmbeddedItemRow(insertionRowInfo.$rowBefore).isStretched
				}
				if (
					insertionRowInfo.$rowAfter &&
					EmbeddedItemRow.isItemRow(insertionRowInfo.$rowAfter)
				) {
					needStretch||=new EmbeddedItemRow(insertionRowInfo.$rowAfter).isStretched
				}
			} else {
				const insertionRow=new EmbeddedItemRow(insertionRowInfo.$row)
				insertionRow.paste($row,sequencePoint,this.withCompactIds)
				needStretch=insertionRow.isStretched
			}
			const row=EmbeddedItemRow.fromEmptyRow($row,'single',this.columnHues)
			updateTimelineOnInsert($row,iColumns)
			row.put(iColumns,$items)
			row.updateStretchButtonHiddenState()
			if (needStretch) {
				row.stretch(this.withCompactIds)
			}
		} else {
			let $row: HTMLTableRowElement
			if (insertionRowInfo.type=='betweenRows') {
				if (insertionRowInfo.$rowBefore.classList.contains('collection')) {
					$row=insertionRowInfo.$rowBefore
				} else if (insertionRowInfo.$rowAfter?.classList.contains('collection')) {
					$row=insertionRowInfo.$rowAfter
				} else {
					$row=makeElement('tr')()()
					insertionRowInfo.$rowBefore.after($row)
					EmbeddedItemRow.fromEmptyRow($row,'collection',this.columnHues)
				}
			} else {
				$row=insertionRowInfo.$row
			}
			updateTimelineOnInsert($row,iColumns)
			const row=new EmbeddedItemRow($row)
			row.insert(sequencePoint,iColumns,$items,this.withCompactIds)
		}
	}
	private get columnHues(): (number|null)[] {
		return this.columnUids.map(uid=>uid==null?null:getHueFromUid(uid))
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
			if (EmbeddedItemRow.isItemRow($row)) {
				const row=new EmbeddedItemRow($row)
				const [greaterCollectionPoint,lesserCollectionPoint]=row.getBoundarySequencePoints()
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
		if (!this.withTotalColumn) $separator.insertCell()
		const $cell=$separator.insertCell()
		$cell.append(
			makeDiv()(
				makeElement('time')()(yearMonthString)
			)
		)
		$cell.colSpan=this.nColumns+1+(this.withTotalColumn?1:0)
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
	private async toggleItemDisclosureWithButton($button: HTMLButtonElement): Promise<void> {
		const $item=$button.closest('.item')
		if (!($item instanceof HTMLElement)) return
		const itemDescriptor=readItemDescriptor($item)
		if (!itemDescriptor) return
		if (getItemDisclosureButtonState($button)) {
			this.collapseItem(itemDescriptor)
		} else {
			$button.disabled=true
			await this.expandItem(itemDescriptor)
			$button.disabled=false
		}
		const $newItem=$button.closest('.item')
		if ($newItem instanceof HTMLElement) {
			$newItem.scrollIntoView({block:'nearest'}) // focusing on button is enough to scroll it in, but it's then too close to the edge
		}
		$button.focus()
	}
	private toggleRowStretchWithButton($button: HTMLButtonElement): void {
		const $row=$button.closest('tr')
		if (!$row) return
		const row=new EmbeddedItemRow($row)
		if (row.isStretched) {
			row.shrink(this.withCompactIds)
		} else {
			row.stretch(this.withCompactIds)
		}
	}
	private highlightHoveredItemDescriptor(descriptor: ItemDescriptor): void {
		for (const $item of this.$gridBody.querySelectorAll(getBroadItemDescriptorSelector(descriptor))) {
			$item.classList.add('highlighted-by-hover')
		}
	}
	private unhighlightHoveredItemDescriptor(descriptor: ItemDescriptor): void {
		for (const $item of this.$gridBody.querySelectorAll(getBroadItemDescriptorSelector(descriptor))) {
			$item.classList.remove('highlighted-by-hover')
		}
	}
	private highlightClickedItem($item: HTMLElement): void {
		requestAnimationFrame(()=>{
			$item.classList.remove('highlighted-by-click-and-fading')
			$item.classList.add('highlighted-by-click')
			requestAnimationFrame(()=>{
				$item.classList.remove('highlighted-by-click')
				$item.classList.add('highlighted-by-click-and-fading')
			})
		})
	}
	private unhighlightClickedItem($item: HTMLElement): void {
		$item.classList.remove('highlighted-by-click')
		$item.classList.remove('highlighted-by-click-and-fading')
	}
}

function getSingleRowLeadingItem($row: HTMLTableRowElement): HTMLElement|null {
	const row=new EmbeddedItemRow($row)
	const itemSequence=[...row.getItemSequence()]
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
