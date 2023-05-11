import type {Server} from '../net'
import {
	getItemCheckbox, markChangesetCellAsCombined, markChangesetCellAsUncombined,
	makeUserCell, makeChangesetCell, makeNoteCell, makeCommentCell
} from './body-item'
import type {GridBatchItem} from '../mux-user-item-db-stream-messenger'
import {toIsoYearMonthString} from '../date'
import {makeElement, makeDiv} from '../util/html'
import {moveInArray} from '../util/types'

type CellTimelineRelation = {
	filled: boolean
	withTimelineAbove: boolean
	withTimelineBelow: boolean
}

type ItemSequenceInfo = {
	timestamp: number
	// rank: number
	// type: MuxBatchItem['type'] | 'separator'
	type: string,
	id: number
	order: number
}

function getItemTypeRank(type: ItemSequenceInfo['type']): number {
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
	return +Infinity
}

function readItemSequenceInfo($e: HTMLElement): ItemSequenceInfo {
	return {
		timestamp: Number($e.dataset.timestamp),
		// rank: Number($e.dataset.rank),
		type: $e.dataset.type??'',
		id: Number($e.dataset.id),
		order: Number($e.dataset.order)
	}
}

function writeItemSequenceInfo($e: HTMLElement, info: ItemSequenceInfo): void {
	$e.dataset.timestamp=String(info.timestamp)
	// $e.dataset.rank=String(info.rank)
	$e.dataset.rank=info.type
	$e.dataset.id=String(info.id)
	$e.dataset.order=String(info.order)
}

function isGreaterItemSequenceInfo(a: ItemSequenceInfo, b: ItemSequenceInfo): boolean {
	if (a.timestamp>b.timestamp) return true
	// if (a.rank>b.rank) return true
	if (getItemTypeRank(a.type)>getItemTypeRank(b.type)) return true
	if (a.id>b.id) return true
	return a.order>b.order
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
		server: Server, columnHues: (number|null)[],
		batchItem: GridBatchItem,
		usernames: Map<number, string>
	): boolean {
		const sequenceInfo=this.getItemSequenceInfo(batchItem)
		if (!sequenceInfo) return false
		const $item=this.renderExpandedItem(server,batchItem,usernames)
		if (!$item) return false
		this.addItem(columnHues,$item,batchItem.iColumns,sequenceInfo)
		return true
	}
	private getItemSequenceInfo(
		{type,item}: GridBatchItem
	): ItemSequenceInfo|null {
		let date: Date
		let id: number
		let order=0
		if (type=='user') {
			date=item.createdAt
			id=item.id
		} else if (type=='changeset' || type=='changesetClose') {
			date=item.createdAt
			if (type=='changesetClose' && item.closedAt) {
				date=item.closedAt
			}
			id=item.id
		} else if (type=='note') {
			date=item.createdAt
			id=item.id
		} else if (type=='changesetComment' || type=='noteComment') {
			date=item.createdAt
			id=item.itemId
			order=item.order
		} else {
			return null
		}
		return {
			timestamp: date.getTime(),
			// rank: getItemTypeRank(type),
			type,
			id,
			order
		}
	}
	private renderExpandedItem(
		server: Server,
		{type,item}: GridBatchItem,
		usernames: Map<number, string>
	): HTMLElement|null {
		if (type=='user') {
			return makeUserCell(server,item)
		} else if (type=='changeset' || type=='changesetClose') {
			return makeChangesetCell(server,item,type=='changesetClose')
		} else if (type=='note') {
			return makeNoteCell(server,item)
		} else if (type=='changesetComment' || type=='noteComment') {
			let username: string|undefined
			if (item.uid) {
				username=usernames.get(item.uid)
			}
			if (type=='noteComment') {
				return makeCommentCell(server,'note',item,username,item.action)
			} else {
				return makeCommentCell(server,'changeset',item,username)
			}
		} else {
			return null
		}
	}
	private addItem(
		columnHues: (number|null)[],
		$masterItem: HTMLElement, iColumns: number[],
		sequenceInfo: ItemSequenceInfo
	): void {
		if (iColumns.length==0) return
		const [$row,cellTimelineRelations]=this.insertRow(iColumns,sequenceInfo)
		$row.classList.add(...$masterItem.classList)
		writeItemSequenceInfo($row,sequenceInfo)
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
	private insertRow(
		iColumns: number[],
		sequenceInfo: ItemSequenceInfo
	): [
		$row: HTMLTableRowElement, cellTimelineRelations: CellTimelineRelation[]
	] {
		const iColumnSet=new Set(iColumns)
		const cellTimelineRelations:CellTimelineRelation[]=this.$timelineCutoffRows.map(($timelineCutoffRow,iColumn)=>({
			filled: iColumnSet.has(iColumn),
			withTimelineAbove: $timelineCutoffRow==null,
			withTimelineBelow: $timelineCutoffRow==null,
		}))
		let $precedingRow:HTMLTableRowElement|undefined
		let i=this.$gridBody.rows.length-1
		for (;i>=0;i--) {
			$precedingRow=this.$gridBody.rows[i]
			const precedingSequenceInfo=readItemSequenceInfo($precedingRow)
			if (isGreaterItemSequenceInfo(precedingSequenceInfo,sequenceInfo)) break
		}
		let $itemRow: HTMLTableRowElement
		const date=new Date(sequenceInfo.timestamp)
		if (!$precedingRow || !isElementWithSameMonth($precedingRow,date)) {
			const yearMonthString=toIsoYearMonthString(date)
			$precedingRow=this.$gridBody.insertRow(i+1)
			$precedingRow.classList.add('separator')
			writeItemSequenceInfo($precedingRow,{
				timestamp: getLastTimestampOfMonth(date),
				type: 'separator',
				id: 0,
				order: 0
			})
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
		if (sequenceInfo.type=='user') {
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
