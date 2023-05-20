import {strict as assert} from 'assert'
import {JSDOM} from 'jsdom'
import {setInsertedRowCellsAndTimeline} from '../../../test-build/grid/timeline.js'

describe("GridBody",()=>{
	const globalProperties=[
		'document',
	]
	beforeEach(function(){
		const jsdom=new JSDOM()
		this.window=jsdom.window
		for (const property of globalProperties) {
			global[property]=jsdom.window[property]
		}
	})
	afterEach(function(){
		for (const property of globalProperties) {
			delete global[property]
		}
	})
	it("sets row appended to empty table",()=>{
		const $tbody=document.createElement('tbody')
		const $row=$tbody.insertRow()
		setInsertedRowCellsAndTimeline($row,[0],[null])
		assertRows($tbody,[
			['a']
		])
	})
})

function assertRows($tbody,rows) {
	assert.equal($tbody.rows.length,rows.length,`Expected table body to have ${rows.length} rows, found ${$tbody.rows.length}`)
	for (let i=0;i<rows.length;i++) {
		const $row=$tbody.rows[i]
		const cells=rows[i]
		assert.equal($row.cells.length,cells.length,`Expected table row to have ${cells.length} cells, found ${$row.cells.length}`)
		for (let j=0;j<cells.length;j++) {
			const $cell=$row.cells[j]
			const cell=cells[j]
			for (const [key,word] of [['a','above'],['b','below']]) {
				const className=`with-timeline-${word}`
				if (cell.includes(key)) {
					assert($cell.classList.contains(className),`Expected cell class '${className}' missing`)
				} else {
					assert(!$cell.classList.contains(className),`Unexpected cell class '${className}' present`)
				}
			}
		}
	}
}
