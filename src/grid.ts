import {getItemCheckbox, markChangesetCardAsCombined, markChangesetCardAsUncombined} from './item'
import type {MuxBatchItem} from './mux-user-item-db-stream'
import {toIsoYearMonthString} from './date'
import {makeElement, makeDiv} from './util/html'

export default class Grid {
	$grid=makeElement('table')('grid')()
	private $colgroup=makeElement('colgroup')()()
	private nColumns=0
	constructor() {
		this.$grid.append(this.$colgroup)
		this.$grid.createTHead()
		this.$grid.createTBody()
		this.setColumns(0)
	}
	setColumns(nColumns: number) {
		this.clearItems()
		this.$grid.style.setProperty('--columns',String(nColumns))
		this.$colgroup.replaceChildren()
		for (let i=0;i<nColumns;i++) {
			this.$colgroup.append(
				makeElement('col')()()
			)
		}
		this.$colgroup.append(
			makeElement('col')('adder')()
		)
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
		const columnTemplate=new Array(this.nColumns).fill(false) as boolean[]
		for (const iColumn of iColumns) {
			columnTemplate[iColumn]=true
		}
		for (const fillCell of columnTemplate) {
			const $cell=$row.insertCell()
			if (!fillCell) continue
			$cell.append(...[...$masterItem.childNodes].map(child=>child.cloneNode(true)))
			const $checkbox=getItemCheckbox($cell)
			if ($checkbox) $checkboxes.push($checkbox)
		}
		if ($checkboxes.length>1) {
			for (const $checkbox of $checkboxes) {
				$checkbox.addEventListener('input',()=>{
					for (const $sameItemCheckbox of $checkboxes) {
						$sameItemCheckbox.checked=$checkbox.checked
					}
				})
			}
		}
	}
	combineChangesets(): void {
		const withClosedChangesets=this.$grid.classList.contains('with-closed-changesets')
		let $itemAbove: HTMLElement|undefined
		for (const $item of this.$tbody.rows) {
			if (!$item.classList.contains('item')) {
				$itemAbove=undefined
				continue
			}
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
						markChangesetCardAsCombined($item,$item.dataset.id??'???')
					} else {
						markChangesetCardAsUncombined($item,$item.dataset.id??'???')
					}
				}
			}
			$itemAbove=$item
		}
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
			const $separator=makeDiv('separator')(
				makeElement('time')()(yearMonthString)
			)
			$separator.dataset.timestamp=String(getLastTimestampOfMonth(date))
			$separator.dataset.rank='0'
			$row=this.$tbody.insertRow(i+1)
			const $cell=$row.insertCell()
			$cell.append($separator)
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

function isElementWithSameMonth($e: HTMLElement, date: Date): boolean {
	if ($e.dataset.timestamp==null) return false
	const elementDate=new Date(Number($e.dataset.timestamp))
	return elementDate.getUTCFullYear()==date.getFullYear() && elementDate.getUTCMonth()==date.getUTCMonth()
}

function getItemTypeRank(type: MuxBatchItem['type']): number {
	// 0 = rank of separators
	switch (type) {
	case 'changeset':
		return 1
	case 'changesetClose':
		return 2
	case 'note':
		return 3
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
