import type {Connection} from '../net'
import {
	getItemCheckbox, markChangesetCellAsCombined, markChangesetCellAsUncombined,
	makeUserCell, makeChangesetCell, makeNoteCell, makeCommentCell
} from './body-item'
import type {MuxBatchItem} from '../mux-user-item-db-stream'
import type {GridBatchItem} from '../mux-user-item-db-stream-messenger'
import {toIsoYearMonthString} from '../date'
import {makeElement, makeDiv} from '../util/html'
import {moveInArray} from '../util/types'

type CellTimelineRelation = {
	filled: boolean
	withTimelineAbove: boolean
	withTimelineBelow: boolean
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
	makeAndAddItem(
		cx: Connection, columnHues: (number|null)[],
		{iColumns,type,item}: GridBatchItem,
		usernames: Map<number, string>
	): boolean {
		let $item: HTMLElement
		let date: Date
		let id: number
		let order: number|undefined
		if (type=='user') {
			$item=makeUserCell(cx.server,item)
			date=item.createdAt
			id=item.id
		} else if (type=='changeset' || type=='changesetClose') {
			$item=makeChangesetCell(cx.server,item,type=='changesetClose')
			date=item.createdAt
			if (type=='changesetClose' && item.closedAt) {
				date=item.closedAt
			}
			id=item.id
		} else if (type=='note') {
			$item=makeNoteCell(cx.server,item)
			date=item.createdAt
			id=item.id
		} else if (type=='changesetComment' || type=='noteComment') {
			let username: string|undefined
			if (item.uid) {
				username=usernames.get(item.uid)
			}
			if (type=='noteComment') {
				$item=makeCommentCell(cx.server,'note',item,username,item.action)
			} else {
				$item=makeCommentCell(cx.server,'changeset',item,username)
			}
			date=item.createdAt
			id=item.itemId
			order=item.order
		} else {
			return false
		}
		this.addItem(columnHues,$item,iColumns,date,type,id,order)
		return true
	}
	private addItem(
		columnHues: (number|null)[],
		$masterItem: HTMLElement, iColumns: number[], date: Date, type: MuxBatchItem['type'], id: number, order?: number
	): void {
		if (iColumns.length==0) return
		const timestamp=date.getTime()
		const rank=getItemTypeRank(type)
		const [$row,cellTimelineRelations]=this.insertRow(iColumns,date,type,id,order)
		$row.classList.add(...$masterItem.classList)
		$row.dataset.timestamp=String(timestamp)
		$row.dataset.rank=String(rank)
		$row.dataset.id=String(id)
		if (order!=null) $row.dataset.order=String(order)
		const $checkboxes:HTMLInputElement[]=[]
		for (const [iColumn,cellTimelineRelation] of cellTimelineRelations.entries()) {
			const $cell=$row.insertCell()
			$cell.classList.toggle('with-timeline-above',cellTimelineRelation.withTimelineAbove)
			$cell.classList.toggle('with-timeline-below',cellTimelineRelation.withTimelineBelow)
			const hue=columnHues[iColumn]
			if (hue!=null) {
				$cell.style.setProperty('--hue',String(hue))
			}
			if (!cellTimelineRelation.filled) continue
			$cell.append(...[...$masterItem.childNodes].map(child=>child.cloneNode(true)))
			const $checkbox=getItemCheckbox($cell)
			if ($checkbox) $checkboxes.push($checkbox)
		}
		for (const $checkbox of $checkboxes) {
			if ($checkboxes.length>1) {
				$checkbox.addEventListener('input',columnCheckboxSyncListener)
			}
			$checkbox.addEventListener('input',this.wrappedItemSelectListener)
		}
	}
	updateTableAccordingToSettings(inOneColumn: boolean, withClosedChangesets: boolean): void {
		let $itemAbove: HTMLElement|undefined
		for (const $item of this.$gridBody.rows) {
			if (!$item.classList.contains('item')) {
				$itemAbove=undefined
				continue
			}
			// combine open+close changeset
			const isConnectedWithAboveItem=(
				$itemAbove &&
				$itemAbove.classList.contains('changeset') &&
				$itemAbove.classList.contains('closed') &&
				$item.dataset.id==$itemAbove.dataset.id
			)
			if ($item.classList.contains('changeset')) {
				if ($item.classList.contains('closed')) {
					$item.classList.toggle('hidden-as-closed',!withClosedChangesets)
				} else {
					if (isConnectedWithAboveItem || !withClosedChangesets) {
						if ($itemAbove && isConnectedWithAboveItem) {
							$itemAbove.classList.add('hidden-as-closed')
						}
						markChangesetCellAsCombined($item,$item.dataset.id??'???')
					} else {
						markChangesetCellAsUncombined($item,$item.dataset.id??'???')
					}
				}
			}
			$itemAbove=$item
			// span columns
			let spanned=false
			for (const $cell of $item.cells) {
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
	private insertRow(iColumns: number[], date: Date, type: MuxBatchItem['type'], id: number, order?: number): [
		$row: HTMLTableRowElement, cellTimelineRelations: CellTimelineRelation[]
	] {
		const iColumnSet=new Set(iColumns)
		const cellTimelineRelations:CellTimelineRelation[]=this.$timelineCutoffRows.map(($timelineCutoffRow,iColumn)=>({
			filled: iColumnSet.has(iColumn),
			withTimelineAbove: $timelineCutoffRow==null,
			withTimelineBelow: $timelineCutoffRow==null,
		}))
		const timestamp=date.getTime()
		const rank=getItemTypeRank(type)
		let $precedingRow:HTMLTableRowElement|undefined
		let i=this.$gridBody.rows.length-1
		for (;i>=0;i--) {
			$precedingRow=this.$gridBody.rows[i]
			const currentTimestamp=Number($precedingRow.dataset.timestamp)
			if (currentTimestamp>timestamp) break
			const currentRank=Number($precedingRow.dataset.rank)
			if (currentRank>rank) break
			const currentId=Number($precedingRow.dataset.id)
			if (currentId>id) break
			if (order!=null) {
				const currentOrder=Number($precedingRow.dataset.order)
				if (currentOrder>order) break
			}
		}
		let $itemRow: HTMLTableRowElement
		if (!$precedingRow || !isElementWithSameMonth($precedingRow,date)) {
			const yearMonthString=toIsoYearMonthString(date)
			$precedingRow=this.$gridBody.insertRow(i+1)
			$precedingRow.classList.add('separator')
			$precedingRow.dataset.timestamp=String(getLastTimestampOfMonth(date))
			$precedingRow.dataset.rank='0'
			const $cell=$precedingRow.insertCell()
			$cell.append(
				makeDiv('month')(
					makeElement('time')()(yearMonthString)
				)
			)
			$cell.colSpan=this.nColumns+1
			$itemRow=this.$gridBody.insertRow(i+2)
		} else {
			$itemRow=this.$gridBody.insertRow(i+1)
		}
		if (type=='user') {
			for (const iColumn of iColumns) {
				this.$timelineCutoffRows[iColumn]=$itemRow
				cellTimelineRelations[iColumn].withTimelineBelow=false
			}
			for (let $followingRow=$itemRow.nextElementSibling;$followingRow;$followingRow=$followingRow.nextElementSibling) {
				if (!($followingRow instanceof HTMLTableRowElement)) continue
				if (!$followingRow.classList.contains('item')) continue
				for (const [iColumn,$cell] of [...$followingRow.cells].entries()) {
					if (!iColumnSet.has(iColumn)) continue
					$cell.classList.remove('with-timeline-above','with-timeline-below')
				}
			}
		}
		return [$itemRow,cellTimelineRelations]
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

function isElementWithSameMonth($e: HTMLElement, date: Date): boolean {
	if ($e.dataset.timestamp==null) return false
	const elementDate=new Date(Number($e.dataset.timestamp))
	return elementDate.getUTCFullYear()==date.getFullYear() && elementDate.getUTCMonth()==date.getUTCMonth()
}

function getItemTypeRank(type: MuxBatchItem['type']): number {
	// 0 = rank of separators
	switch (type) {
	case 'user':
		return 1
	case 'changeset':
		return 2
	case 'changesetClose':
		return 3
	case 'note':
		return 4
	case 'changesetComment':
		return 5
	case 'noteComment':
		return 6
	}
}

function getLastTimestampOfMonth(date: Date): number {
	let monthIndex=date.getUTCMonth()
	let year=date.getUTCFullYear()
	monthIndex++
	if (monthIndex>=12) {
		monthIndex=0
		year++
	}
	return Date.UTC(year,monthIndex)-1
}
