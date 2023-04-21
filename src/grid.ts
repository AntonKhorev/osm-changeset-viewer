import {markChangesetCardAsCombined, markChangesetCardAsUncombined} from './item'
import type {MuxBatchItem} from './mux-user-item-db-stream'
import {toIsoYearMonthString} from './date'
import {makeElement, makeDiv} from './util/html'

const nHeadRows=2
let gridCounter=0

export default class Grid {
	$grid=makeDiv('grid')()
	$style=makeElement('style')()()
	id=`grid-${++gridCounter}`
	constructor() {
		this.$grid.id=this.id
		this.setColumns(0)
	}
	setColumns(nColumns: number) {
		this.clearItems()
		const repeatTemplateColumnsStyle=nColumns>0 ? `repeat(${nColumns},minmax(20ch,50ch)) ` : ``
		let style=
			`#${this.id} {\n`+
			`	display: grid;\n`+
			`	grid-template-columns: ${repeatTemplateColumnsStyle}minmax(20ch,1fr);\n`+
			`}\n`
		for (let i=0;i<nColumns;i++) {
			style+=`#${this.id} > .item[data-column="${i}"] { grid-column: ${i+1}; }\n`
		}
		style+=
			`#${this.id}.with-expanded-items > .item {\n`+
			`	grid-column: 1 / -1;\n`+
			`}\n`
		this.$style.textContent=style
	}
	addItem($masterItem: HTMLElement, iColumns: number[], date: Date, type: MuxBatchItem['type'], id: number) {
		if (iColumns.length==0) return
		let $precedingElement=this.getPrecedingElement(date,type,id)
		let nRow=getGridRow($precedingElement)+1
		const timestamp=date.getTime()
		const rank=getItemTypeRank(type)
		for (const [i,iColumn] of iColumns.entries()) {
			const $item=$masterItem.cloneNode(true) as HTMLElement
			if (i) $item.classList.add('duplicate')
			$item.dataset.column=String(iColumn)
			$item.dataset.timestamp=String(timestamp)
			$item.dataset.rank=String(rank)
			$item.dataset.id=String(id)
			setGridRow($item,nRow)
			$precedingElement.after($item)
			$precedingElement=$item
		}
		if (!$precedingElement.nextElementSibling) return
		const nNextRowBefore=getGridRow($precedingElement.nextElementSibling)
		const nNextRowAfter=nRow+1
		const nRowDiff=nNextRowAfter-nNextRowBefore
		for (let $e:Element|null=$precedingElement.nextElementSibling;$e;$e=$e.nextElementSibling) {
			if (!($e instanceof HTMLElement)) continue
			setGridRow($e,getGridRow($e)+nRowDiff)
		}
	}
	combineChangesets(): void {
		const withClosedChangesets=this.$grid.classList.contains('with-closed-changesets')
		const $itemsAbove=new Map<number,HTMLElement>()
		for (const $item of this.getElementsAfterGuard()) {
			if (!($item instanceof HTMLElement) || !$item.classList.contains('item')) {
				$itemsAbove.clear()
				continue
			}
			const column=Number($item.dataset.column)
			const $itemAbove=$itemsAbove.get(column)
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
						if (isConnectedWithAboveItem) $itemAbove.hidden=true
						markChangesetCardAsCombined($item,$item.dataset.id??'???')
					} else {
						markChangesetCardAsUncombined($item,$item.dataset.id??'???')
					}
				}
			}
			$itemsAbove.set(column,$item)
		}
	}
	private getPrecedingElement(date: Date, type: MuxBatchItem['type'], id: number): HTMLElement {
		const timestamp=date.getTime()
		const rank=getItemTypeRank(type)
		let $e=this.$grid.lastElementChild
		for (;$e;$e=$e.previousElementSibling) {
			if (!($e instanceof HTMLElement)) continue
			if (isFrontGuardElement($e)) break
			const currentTimestamp=Number($e.dataset.timestamp)
			if (currentTimestamp>timestamp) break
			const currentRank=Number($e.dataset.rank)
			if (currentRank>rank) break
			const currentId=Number($e.dataset.id)
			if (currentId>id) break
		}
		if (!$e || isFrontGuardElement($e) || !isElementWithSameMonth($e,date)) {
			const yearMonthString=toIsoYearMonthString(date)
			const $separator=makeDiv('separator')(
				makeElement('time')()(yearMonthString)
			)
			$separator.dataset.timestamp=String(getLastTimestampOfMonth(date))
			$separator.dataset.rank='0'
			setGridRow($separator,getGridRow($e)+1)
			if ($e) {
				$e.after($separator)
			} else {
				this.$grid.append($separator)
			}
			return $separator
		} else {
			return $e
		}
	}
	private clearItems() {
		let remove=false
		for (const $e of [...this.$grid.children]) {
			if (isFrontGuardElement($e)) {
				remove=true
				continue
			}
			if (remove) {
				$e.remove()
			}
		}
	}
	private *getElementsAfterGuard() {
		let started=false
		for (const $e of this.$grid.children) {
			if (started) {
				yield $e
			} else if (isFrontGuardElement($e)) {
				started=true
				continue
			}
		}
	}
}

function getGridRow($e: unknown): number {
	if ($e instanceof HTMLElement) {
		return Number($e.style.gridRow) || nHeadRows
	} else {
		return nHeadRows
	}
}
function setGridRow($e: HTMLElement, nRow: number) {
	$e.style.gridRow=String(nRow)
}

function isFrontGuardElement($e: Element): boolean {
	return $e instanceof HTMLFormElement
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
