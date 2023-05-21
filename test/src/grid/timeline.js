import {strict as assert} from 'assert'
import {JSDOM} from 'jsdom'
import {setInsertedRowCellsAndTimeline} from '../../../test-build/grid/timeline.js'

function insertRow($tbody,className,cells) {
	const $row=$tbody.insertRow()
	$row.classList.add(className)
	for (const cell of cells) {
		const $cell=$row.insertCell()
		if (cell.includes('a')) $cell.classList.add('with-timeline-above')
		if (cell.includes('b')) $cell.classList.add('with-timeline-below')
	}
}

describe("timeline module",()=>{
	const globalProperties=[
		'document',
		'HTMLTableRowElement',
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
			['a'],
		])
	})
	it("sets row appended to row without timeline",()=>{
		const $tbody=document.createElement('tbody')
		insertRow($tbody,'item',[''])
		const $row=$tbody.insertRow()
		setInsertedRowCellsAndTimeline($row,[0],[null])
		assertRows($tbody,[
			['ab'],
			['a'],
		])
	})
	it("sets row appended to row with terminating timeline",()=>{
		const $tbody=document.createElement('tbody')
		insertRow($tbody,'item',['a'])
		const $row=$tbody.insertRow()
		setInsertedRowCellsAndTimeline($row,[0],[null])
		assertRows($tbody,[
			['ab'],
			['a'],
		])
	})
	it("sets row appended to separator",()=>{
		const $tbody=document.createElement('tbody')
		insertRow($tbody,'separator',[''])
		const $row=$tbody.insertRow()
		setInsertedRowCellsAndTimeline($row,[0],[null])
		assertRows($tbody,[
			['-'],
			['a'],
		])
	})
	it("sets row appended to row with terminating timeline above separator",()=>{
		const $tbody=document.createElement('tbody')
		insertRow($tbody,'item',['a'])
		insertRow($tbody,'separator',[''])
		const $row=$tbody.insertRow()
		setInsertedRowCellsAndTimeline($row,[0],[null])
		assertRows($tbody,[
			['ab'],
			['-'],
			['a'],
		])
	})
	it("sets row appended to row with terminating timeline above empty row",()=>{
		const $tbody=document.createElement('tbody')
		insertRow($tbody,'item',['a'])
		insertRow($tbody,'item',[''])
		const $row=$tbody.insertRow()
		setInsertedRowCellsAndTimeline($row,[0],[null])
		assertRows($tbody,[
			['ab'],
			['ab'],
			['a'],
		])
	})
	it("sets row appended to 2-column row with different timeline heights",()=>{
		const $tbody=document.createElement('tbody')
		insertRow($tbody,'item',['a ','ab'])
		insertRow($tbody,'item',['  ','a '])
		const $row=$tbody.insertRow()
		setInsertedRowCellsAndTimeline($row,[0,1],[null,null])
		assertRows($tbody,[
			['ab','ab'],
			['ab','ab'],
			['a ','a '],
		])
	})
	it("sets row with one filled column appended to 2-column row with different timeline heights",()=>{
		const $tbody=document.createElement('tbody')
		insertRow($tbody,'item',['a ','ab'])
		insertRow($tbody,'item',['  ','a '])
		const $row=$tbody.insertRow()
		setInsertedRowCellsAndTimeline($row,[0],[null,null])
		assertRows($tbody,[
			['ab','ab'],
			['ab','a '],
			['a ','  '],
		])
	})
	it("sets row inserted before row with terminating timeline",()=>{
		const $tbody=document.createElement('tbody')
		const $row=$tbody.insertRow()
		insertRow($tbody,'item',['a'])
		setInsertedRowCellsAndTimeline($row,[0],[null])
		assertRows($tbody,[
			['ab'],
			['a'],
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
			const cellName=`cell[${i},${j}]`
			assertTimelineClasses($cell,cell,cellName)
		}
	}
}

function assertTimelineClasses($cell,keys,cellName='cell') {
	for (const [key,word] of [['a','above'],['b','below']]) {
		const className=`with-timeline-${word}`
		if (keys.includes(key)) {
			assert($cell.classList.contains(className),`Expected ${cellName} class '${className}' missing`)
		} else {
			assert(!$cell.classList.contains(className),`Unexpected ${cellName} class '${className}' present`)
		}
	}
}
