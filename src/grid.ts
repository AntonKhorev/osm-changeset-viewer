import {getItemCheckbox, markChangesetCellAsCombined, markChangesetCellAsUncombined} from './item'
import type {MuxBatchItem} from './mux-user-item-db-stream'
import {toIsoYearMonthString} from './date'
import {makeElement, makeDiv} from './util/html'
import {moveInArray} from './util/types'

export default class Grid {
	$grid=makeElement('table')('grid')()
	onItemSelect: ()=>void = ()=>{}
	private wrappedItemSelectListener: ()=>void
	private $colgroup=makeElement('colgroup')()()
	private columnHues: (number|null)[] = []
	constructor() {
		this.$grid.append(this.$colgroup)
		this.$grid.createTHead()
		this.$grid.createTBody()
		this.setColumns([])
		this.wrappedItemSelectListener=()=>this.onItemSelect()
	}
	get nColumns(): number {
		return this.columnHues.length
	}
	setColumns(columnHues: (number|null)[]) {
		this.clearItems()
		this.setColumnHues(columnHues)
		this.$grid.style.setProperty('--columns',String(this.nColumns))
		this.$colgroup.replaceChildren()
		for (let i=0;i<this.nColumns;i++) {
			this.$colgroup.append(
				makeElement('col')()()
			)
		}
		this.$colgroup.append(
			makeElement('col')('adder')()
		)
	}
	setColumnHues(columnHues: (number|null)[]) {
		this.columnHues=columnHues
		// TODO update existing table cells - currently not required because table is always cleared
	}
	addItem($masterItem: HTMLElement, iColumns: number[], date: Date, type: MuxBatchItem['type'], id: number) {
		if (iColumns.length==0) return
		const timestamp=date.getTime()
		const rank=getItemTypeRank(type)
		const $row=this.insertRow(date,type,id)
		$row.classList.add(...$masterItem.classList)
		$row.dataset.timestamp=String(timestamp)
		$row.dataset.rank=String(rank)
		$row.dataset.id=String(id)
		const $checkboxes:HTMLInputElement[]=[]
		const columnTemplate=this.columnHues.map(()=>false)
		for (const iColumn of iColumns) {
			columnTemplate[iColumn]=true
		}
		for (const [iColumn,fillCell] of columnTemplate.entries()) {
			const $cell=$row.insertCell()
			if (!fillCell) continue
			const hue=this.columnHues[iColumn]
			if (hue!=null) {
				$cell.style.setProperty('--hue',String(hue))
			}
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
	updateTableAccordingToSettings(): void {
		const inOneColumn=this.$grid.classList.contains('in-one-column')
		const withClosedChangesets=this.$grid.classList.contains('with-closed-changesets')
		let $itemAbove: HTMLElement|undefined
		for (const $item of this.$tbody.rows) {
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
					$item.hidden=!withClosedChangesets
				} else {
					if (isConnectedWithAboveItem || !withClosedChangesets) {
						if ($itemAbove && isConnectedWithAboveItem) $itemAbove.hidden=true
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
		moveInArray(this.columnHues,iShiftFrom,iShiftTo)
		for (const $row of this.$tbody.rows) {
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
		const hasChecked=this.columnHues.map(()=>false)
		const hasUnchecked=this.columnHues.map(()=>false)
		for (const $row of this.$tbody.rows) {
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
		for (const $row of this.$tbody.rows) {
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
	private insertRow(date: Date, type: MuxBatchItem['type'], id: number): HTMLTableRowElement {
		const timestamp=date.getTime()
		const rank=getItemTypeRank(type)
		let $row:HTMLTableRowElement|undefined
		let i=this.$tbody.rows.length-1
		for (;i>=0;i--) {
			$row=this.$tbody.rows[i]
			const currentTimestamp=Number($row.dataset.timestamp)
			if (currentTimestamp>timestamp) break
			const currentRank=Number($row.dataset.rank)
			if (currentRank>rank) break
			const currentId=Number($row.dataset.id)
			if (currentId>id) break
		}
		if (!$row || !isElementWithSameMonth($row,date)) {
			const yearMonthString=toIsoYearMonthString(date)
			$row=this.$tbody.insertRow(i+1)
			$row.classList.add('separator')
			$row.dataset.timestamp=String(getLastTimestampOfMonth(date))
			$row.dataset.rank='0'
			const $cell=$row.insertCell()
			$cell.append(
				makeDiv('month')(
					makeElement('time')()(yearMonthString)
				)
			)
			$cell.colSpan=this.nColumns+1
			return this.$tbody.insertRow(i+2)
		} else {
			return this.$tbody.insertRow(i+1)
		}
	}
	private clearItems(): void {
		this.$tbody.replaceChildren()
	}
	private get $tbody(): HTMLTableSectionElement {
		return this.$grid.tBodies[0]
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
