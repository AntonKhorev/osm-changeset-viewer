import {toIsoYearMonthString} from './date'
import {makeElement, makeDiv} from './util/html'

const nHeadRows=2
let gridCounter=0

export default class Grid {
	$grid=makeDiv('grid')()
	$style=makeElement('style')()()
	id=`grid-${++gridCounter}`
	nRows=nHeadRows
	nextSeparatorTimestamp: number|undefined
	constructor() {
		this.$grid.id=this.id
		this.setColumns(0)
	}
	setColumns(nColumns: number) {
		this.nRows=nHeadRows
		this.nextSeparatorTimestamp=undefined
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
	startNewRow(date: Date) {
		this.nRows++
		if (this.nextSeparatorTimestamp==null || date.getTime()<this.nextSeparatorTimestamp) {
			const yearMonthString=toIsoYearMonthString(date)
			const $separator=makeDiv('separator')(
				makeElement('time')()(yearMonthString)
			)
			this.stampRow($separator)
			this.$grid.append($separator)
			this.nextSeparatorTimestamp=Date.parse(yearMonthString)
			this.nRows++
		}
	}
	appendItem($item: HTMLElement, iColumn: number) {
		$item.dataset.column=String(iColumn)
		this.stampRow($item)
		this.$grid.append($item)
	}
	private stampRow($e: HTMLElement): void {
		$e.style.gridRow=String(this.nRows)
	}
	private clearItems() {
		let remove=false
		for (const $e of [...this.$grid.children]) {
			if ($e instanceof HTMLFormElement) {
				remove=true
				continue
			}
			if (remove) {
				$e.remove()
			}
		}
	}
}
