import {makeElement, makeDiv} from './util/html'

let gridCounter=0

export default class Grid {
	$grid=makeDiv()()
	$style=makeElement('style')()()
	id=`grid-${++gridCounter}`
	nChangesets=0
	constructor() {
		this.$grid.id=this.id
		this.setColumns(0)
	}
	setColumns(nColumns: number) {
		this.nChangesets=0
		for (const $changeset of this.$grid.querySelectorAll('.changeset')) {
			$changeset.remove()
		}
		const repeatTemplateColumnsStyle=nColumns>0 ? `repeat(${nColumns},minmax(20ch,50ch)) ` : ``
		let style=
			`#${this.id} {\n`+
			`	display: grid;\n`+
			`	grid-template-columns: ${repeatTemplateColumnsStyle}minmax(20ch,1fr);\n`+
			`}\n`
		for (let i=0;i<nColumns;i++) {
			style+=`#${this.id} > .changeset[data-column="${i}"] { grid-column: ${i+1}; }\n`
		}
		style+=
			`#${this.id}.with-expanded-changesets > .changeset {\n`+
			`	grid-column: 1 / -1;\n`+
			`}\n`
		this.$style.textContent=style
	}
	appendChangeset($changeset: HTMLElement, iColumn: number) {
		$changeset.dataset.column=String(iColumn)
		$changeset.style.gridRow=String(++this.nChangesets+1)
		this.$grid.append($changeset)
	}
}
