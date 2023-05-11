import type {Server} from '../net'
import type {ItemSequenceInfo} from './sequence'
import {
	isGreaterItemSequenceInfo, getItemSequenceInfo,
	readItemSequenceInfo, readItemSequenceInfoAndCheckIfInSameMonth,
	writeItemSequenceInfo, writeSeparatorSequenceInfo
} from './sequence'
import {
	getItemCheckbox, markChangesetCellAsCombined, markChangesetCellAsUncombined,
	renderCollapsedItem, renderExpandedItem
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

type PrecedingElement = {
	type: 'absent'
} | {
	type: 'item'
	$row: HTMLTableRowElement
} | {
	type: 'collection'
	$row: HTMLTableRowElement
	$cells: (HTMLElement|null)[]
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
		usernames: Map<number, string>
	): boolean {
		const sequenceInfo=getItemSequenceInfo(batchItem)
		if (!sequenceInfo) return false
		// const $item=renderCollapsedItem(server,batchItem,usernames)
		const $item=renderExpandedItem(server,batchItem,usernames)
		if (!$item) return false
		// this.insertItem(columnHues,$item,batchItem.iColumns,sequenceInfo,true)
		this.insertItem(columnHues,$item,batchItem.iColumns,sequenceInfo,false)
		return true
	}
	private insertItem(
		columnHues: (number|null)[],
		$masterItem: HTMLElement, iColumns: number[],
		sequenceInfo: ItemSequenceInfo,
		isCollapsed: boolean
	): void {
		if (iColumns.length==0) return
		const $cells=this.insertItemCells(columnHues,iColumns,sequenceInfo,isCollapsed,[...$masterItem.classList])
		const $checkboxes:HTMLInputElement[]=[]
		for (const $cell of $cells) {
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
	private insertItemCells(
		columnHues: (number|null)[],
		iColumns: number[],
		sequenceInfo: ItemSequenceInfo,
		isCollapsed: boolean,
		classNames: string[]
	): HTMLElement[] {
		const iColumnSet=new Set(iColumns)
		const cellTimelineRelations:CellTimelineRelation[]=this.$timelineCutoffRows.map(($timelineCutoffRow,iColumn)=>({
			filled: iColumnSet.has(iColumn),
			withTimelineAbove: $timelineCutoffRow==null,
			withTimelineBelow: $timelineCutoffRow==null,
		}))
		const preceding=this.getPrecedingElement(sequenceInfo)
		const $row=makeElement('tr')()()
		const date=new Date(sequenceInfo.timestamp)
		if (preceding.type=='absent' || !readItemSequenceInfoAndCheckIfInSameMonth(preceding.$row,date)) {
			const yearMonthString=toIsoYearMonthString(date)
			const $separator=this.insertRow(preceding)
			$separator.classList.add('separator')
			writeSeparatorSequenceInfo($separator,date)
			const $cell=$separator.insertCell()
			$cell.append(
				makeDiv('month')(
					makeElement('time')()(yearMonthString)
				)
			)
			$cell.colSpan=this.nColumns+1
			$separator.after($row)
		} else {
			preceding.$row.after($row)
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
		$row.classList.add(...classNames)
		writeItemSequenceInfo($row,sequenceInfo)
		const $cells:HTMLElement[]=[]
		for (const [iColumn,cellTimelineRelation] of cellTimelineRelations.entries()) {
			const $cell=$row.insertCell()
			$cell.classList.toggle('with-timeline-above',cellTimelineRelation.withTimelineAbove)
			$cell.classList.toggle('with-timeline-below',cellTimelineRelation.withTimelineBelow)
			const hue=columnHues[iColumn]
			if (hue!=null) {
				$cell.style.setProperty('--hue',String(hue))
			}
			if (!cellTimelineRelation.filled) continue
			$cells.push($cell)
		}
		return $cells
	}
	private getPrecedingElement(sequenceInfo: ItemSequenceInfo): PrecedingElement {
		const findPrecedingCollectionCell=($rowCell:HTMLTableCellElement)=>{
			const $cells=$rowCell.querySelectorAll(':scope > .cell')
			for (let i=$cells.length-1;i>=0;i++) {
				const $cell=$cells[i]
				if (!($cell instanceof HTMLElement)) continue
				const precedingSequenceInfo=readItemSequenceInfo($cell)
				if (isGreaterItemSequenceInfo(precedingSequenceInfo,sequenceInfo)) {
					return $cell
				}
			}
			return null
		}
		for (let i=this.$gridBody.rows.length-1;i>=0;i--) {
			const $row=this.$gridBody.rows[i]
			if ($row.classList.contains('collection')) {
				const $cells=[...$row.cells].map(findPrecedingCollectionCell)
				if (!$cells.every($cell=>$cell==null)) {
					return {type:'collection',$row,$cells}
				}
			} else {
				const precedingSequenceInfo=readItemSequenceInfo($row)
				if (isGreaterItemSequenceInfo(precedingSequenceInfo,sequenceInfo)) {
					return {type:'item',$row}
				}
			}
		}
		return {type:'absent'}
	}
	private insertRow(preceding: PrecedingElement): HTMLTableRowElement {
		if (preceding.type=='absent') {
			return this.$gridBody.insertRow(0)
		}
		const $row=makeElement('tr')()()
		preceding.$row.after($row)
		if (preceding.type=='collection') {
			const $rowCellChildrenAfters=preceding.$cells.map(($precedingCell,i)=>{
				const $rowCell=preceding.$row.cells[i]
				const $rowCellChildrenAfter:Element[]=[]
				let metPrecedingCell=$precedingCell!=null
				for (const $rowCellChild of $rowCell.children) {
					if (metPrecedingCell) {
						$rowCellChildrenAfter.push($rowCellChild)
					}
					if ($rowCellChild==$precedingCell) {
						metPrecedingCell=true
					}
				}
				return $rowCellChildrenAfter
			})
			if ($rowCellChildrenAfters.some($rowCellChildrenAfter=>$rowCellChildrenAfter.length>0)) {
				const $rowAfter=makeElement('tr')('collection')()
				for (const $rowCellChildrenAfter of $rowCellChildrenAfters) {
					$rowAfter.insertCell().append(...$rowCellChildrenAfter)
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
