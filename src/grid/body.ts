import type {Server} from '../net'
import type {ItemSequenceInfo} from './sequence'
import {
	isGreaterItemSequenceInfo, getItemSequenceInfo,
	readItemSequenceInfo, writeItemSequenceInfo, writeSeparatorSequenceInfo
} from './sequence'
import {
	getItemCheckbox, markChangesetItemAsCombined, markChangesetItemAsUncombined,
	makeItemShell, writeCollapsedItemFlow, writeExpandedItemFlow
} from './body-item'
import type {GridBatchItem} from '../mux-user-item-db-stream-messenger'
import {toIsoYearMonthString} from '../date'
import {makeElement, makeDiv} from '../util/html'
import {moveInArray} from '../util/types'

type CellTimelineRelation = {
	withTimelineAbove: boolean
	withTimelineBelow: boolean
}

type GridPosition = {
	type: 'afterRow'
	$row: HTMLTableRowElement
} | {
	type: 'insideRow'
	$row: HTMLTableRowElement
	$items: (HTMLElement|null)[]
}

export default class GridBody {
	$gridBody=makeElement('tbody')()()
	onItemSelect: ()=>void = ()=>{}
	private wrappedItemSelectListener: ()=>void
	private $timelineCutoffRows: (HTMLTableRowElement|null)[] = []
	constructor() {
		this.wrappedItemSelectListener=()=>this.onItemSelect()
	}
	get nColumns(): number {
		return this.$timelineCutoffRows.length
	}
	setColumns(nColumns: number): void {
		this.$timelineCutoffRows=new Array(nColumns).fill(null)
		this.$gridBody.replaceChildren()
	}
	addItem(
		server: Server, columnHues: (number|null)[],
		batchItem: GridBatchItem,
		usernames: Map<number, string>,
		isCollapsed: boolean
	): boolean {
		const sequenceInfo=getItemSequenceInfo(batchItem)
		if (!sequenceInfo) return false
		const $itemAndFlow=makeItemShell(batchItem)
		if (!$itemAndFlow) return false
		const [$item,$flow]=$itemAndFlow
		if (isCollapsed) {
			writeCollapsedItemFlow($flow,server,batchItem,usernames)
		} else {
			writeExpandedItemFlow($flow,server,batchItem,usernames)
		}
		this.insertItem(columnHues,$item,batchItem.iColumns,sequenceInfo,isCollapsed)
		return true
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
					$item.classList.toggle('hidden-as-closed',!withClosedChangesets)
				} else {
					if (isConnectedWithLaterItem || !withClosedChangesets) {
						if ($laterItem && isConnectedWithLaterItem) {
							$laterItem.classList.add('hidden-as-closed')
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
		moveInArray(this.$timelineCutoffRows,iShiftFrom,iShiftTo)
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
		const hasChecked=this.$timelineCutoffRows.map(()=>false)
		const hasUnchecked=this.$timelineCutoffRows.map(()=>false)
		for (const $row of this.$gridBody.rows) {
			if (!$row.classList.contains('changeset')) continue
			for (const [iColumn,$cell] of [...$row.cells].entries()) {
				const $checkbox=getItemCheckbox($cell)
				if (!$checkbox) continue
				if ($checkbox.checked) {
					hasChecked[iColumn]=true
				} else {
					hasUnchecked[iColumn]=true
				}
			}
		}
		return [hasChecked,hasUnchecked]
	}
	triggerColumnCheckboxes(iColumn: number, isChecked: boolean): void {
		for (const $row of this.$gridBody.rows) {
			if (!$row.classList.contains('changeset')) continue
			const $cell=$row.cells[iColumn]
			if (!$cell) continue
			const $checkbox=getItemCheckbox($cell)
			if (!$checkbox) continue
			$checkbox.checked=isChecked
			syncColumnCheckboxes($checkbox)
		}
		this.onItemSelect()
	}
	private insertItem(
		columnHues: (number|null)[],
		$masterItem: HTMLElement, iColumns: number[],
		sequenceInfo: ItemSequenceInfo,
		isCollapsed: boolean
	): void {
		if (iColumns.length==0) return
		const $placeholders=this.insertItemPlaceholders(columnHues,iColumns,sequenceInfo,isCollapsed,[...$masterItem.classList])
		const $checkboxes:HTMLInputElement[]=[]
		for (const $placeholder of $placeholders) {
			$placeholder.append(...[...$masterItem.childNodes].map(child=>child.cloneNode(true)))
			const $checkbox=getItemCheckbox($placeholder)
			if ($checkbox) $checkboxes.push($checkbox)
		}
		for (const $checkbox of $checkboxes) {
			if ($checkboxes.length>1) {
				$checkbox.addEventListener('input',columnCheckboxSyncListener)
			}
			$checkbox.addEventListener('input',this.wrappedItemSelectListener)
		}
	}
	private insertItemPlaceholders(
		columnHues: (number|null)[],
		iColumns: number[],
		sequenceInfo: ItemSequenceInfo,
		isCollapsed: boolean,
		classNames: string[]
	): HTMLElement[] {
		const iColumnSet=new Set(iColumns)
		const cellTimelineRelations:CellTimelineRelation[]=this.$timelineCutoffRows.map(($timelineCutoffRow,iColumn)=>({
			withTimelineAbove: $timelineCutoffRow==null,
			withTimelineBelow: $timelineCutoffRow==null,
		}))
		let position=this.getGridPositionAndInsertSeparatorIfNeeded(sequenceInfo)
		let $row:HTMLTableRowElement
		let isNewRow:boolean
		if (isCollapsed && position.type=='insideRow') {
			$row=position.$row
			isNewRow=false
		} else {
			$row=this.insertRow(position)
			isNewRow=true
		}
		if (sequenceInfo.type=='user') {
			for (const iColumn of iColumns) {
				this.$timelineCutoffRows[iColumn]=$row
				cellTimelineRelations[iColumn].withTimelineBelow=false
			}
			for (let $followingRow=$row.nextElementSibling;$followingRow;$followingRow=$followingRow.nextElementSibling) {
				if (!($followingRow instanceof HTMLTableRowElement)) continue
				if (!$followingRow.classList.contains('item')) continue
				for (const [iColumn,$cell] of [...$followingRow.cells].entries()) {
					if (!iColumnSet.has(iColumn)) continue
					$cell.classList.remove('with-timeline-above','with-timeline-below')
				}
			}
		}
		if (isNewRow) {
			for (const [iColumn,cellTimelineRelation] of cellTimelineRelations.entries()) {
				const $cell=$row.insertCell()
				$cell.classList.toggle('with-timeline-above',cellTimelineRelation.withTimelineAbove)
				$cell.classList.toggle('with-timeline-below',cellTimelineRelation.withTimelineBelow)
				const hue=columnHues[iColumn]
				if (hue!=null) {
					$cell.style.setProperty('--hue',String(hue))
				}
			}
		}
		if (isCollapsed) {
			$row.classList.add('collection')
			const $placeholders:HTMLElement[]=[]
			for (const i of iColumnSet) {
				const $placeholder=makeElement('span')(...classNames)()
				writeItemSequenceInfo($placeholder,sequenceInfo)
				const $cell=$row.cells[i]
				if (position.type=='insideRow') {
					const $precedingItem=position.$items[i]
					if ($precedingItem==null) {
						$cell.prepend($placeholder)
					} else {
						$precedingItem.after($placeholder)
					}
				} else {
					$cell.append($placeholder)
				}
				$placeholders.push($placeholder)
			}
			return $placeholders
		} else {
			$row.classList.add(...classNames)
			writeItemSequenceInfo($row,sequenceInfo)
			return [...iColumnSet].map(i=>$row.cells[i])
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
						const precedingSequenceInfo=readItemSequenceInfo($item)
						if (!isSameMonthTimestamps(precedingSequenceInfo.timestamp,sequenceInfo.timestamp)) {
							isSameMonthRow=false
						}
						if (isGreaterItemSequenceInfo(precedingSequenceInfo,sequenceInfo)) {
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
				const precedingSequenceInfo=readItemSequenceInfo($row)
				if (isGreaterItemSequenceInfo(precedingSequenceInfo,sequenceInfo)) {
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
		position.$row.after($row)
		if (position.type=='insideRow') {
			const $cellChildrenAfterInColumns=position.$items.map(($precedingItem,i)=>{
				const $cell=position.$row.cells[i]
				const $cellChildrenAfter:Element[]=[]
				let metPrecedingItem=$precedingItem!=null
				for (const $cellChild of $cell.children) {
					if (metPrecedingItem) {
						$cellChildrenAfter.push($cellChild)
					}
					if ($cellChild==$precedingItem) {
						metPrecedingItem=true
					}
				}
				return $cellChildrenAfter
			})
			if ($cellChildrenAfterInColumns.some($cellChildrenAfter=>$cellChildrenAfter.length>0)) {
				const $rowAfter=makeElement('tr')('collection')()
				for (const $cellChildrenAfter of $cellChildrenAfterInColumns) {
					$rowAfter.insertCell().append(...$cellChildrenAfter)
				}
				$row.after($rowAfter)
			}
		}
		return $row
	}
}

function columnCheckboxSyncListener(this: HTMLInputElement): void {
	syncColumnCheckboxes(this)
}

function syncColumnCheckboxes($checkbox: HTMLInputElement): void {
	const $itemRow=$checkbox.closest('tr.item')
	if (!$itemRow) return
	for (const $sameItemCheckbox of $itemRow.querySelectorAll('input[type=checkbox]')) {
		if (!($sameItemCheckbox instanceof HTMLInputElement)) continue
		$sameItemCheckbox.checked=$checkbox.checked
	}
}

function isSameMonthTimestamps(t1: number, t2: number): boolean {
	const d1=new Date(t1)
	const d2=new Date(t2)
	return d1.getUTCFullYear()==d2.getFullYear() && d1.getUTCMonth()==d2.getUTCMonth()
}
