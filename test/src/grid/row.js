import {strict as assert} from 'assert'
import {JSDOM} from 'jsdom'
import {makeRow, makeCell, makeChangeset, makeChangesetPoint} from '../../grid.js'
import ItemRow from '../../../test-build/grid/row.js'

const hue='--hue: 123;'

describe("ItemRow",()=>{
	const globalProperties=[
		'document',
		'HTMLElement',
		'HTMLTableCellElement',
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
	it("reports empty collection",()=>{
		const $row=makeRow(makeCell('',hue))
		const row=new ItemRow($row)
		assert.equal(row.isEmpty(),true)
	})
	it("reports nonempty collection",()=>{
		const $row=makeRow(makeCell('ab',hue,makeChangeset('2023-05-07',10101)))
		const row=new ItemRow($row)
		assert.equal(row.isEmpty(),false)
	})
	it("gets boundary points of empty collection",()=>{
		const $row=makeRow(makeCell('',hue))
		const row=new ItemRow($row)
		assert.deepEqual(row.getBoundarySequencePoints(),[
			null,
			null
		])
	})
	it("gets boundary points of single-element collection",()=>{
		const $row=makeRow(makeCell('ab',hue,makeChangeset('2023-05-07',10101)))
		const row=new ItemRow($row)
		assert.deepEqual(row.getBoundarySequencePoints(),[
			makeChangesetPoint('2023-05-07',10101),
			makeChangesetPoint('2023-05-07',10101)
		])
	})
	it("gets boundary points of 2-element collection",()=>{
		const $row=makeRow(makeCell('ab',hue,
			makeChangeset('2023-05-08',10102),
			makeChangeset('2023-05-07',10101)
		))
		const row=new ItemRow($row)
		assert.deepEqual(row.getBoundarySequencePoints(),[
			makeChangesetPoint('2023-05-08',10102),
			makeChangesetPoint('2023-05-07',10101)
		])
	})
	it("gets boundary points of 2-column 2-element collection",()=>{
		const $row=makeRow(
			makeCell('ab',hue,makeChangeset('2023-05-09',10103)),
			makeCell('ab',hue,makeChangeset('2023-05-07',10101))
		)
		const row=new ItemRow($row)
		assert.deepEqual(row.getBoundarySequencePoints(),[
			makeChangesetPoint('2023-05-09',10103),
			makeChangesetPoint('2023-05-07',10101)
		])
	})
	it("gets boundary points of 2-element collection with empty cell",()=>{
		const $row=makeRow(
			makeCell('ab',hue,makeChangeset('2023-05-09',10103)),
			makeCell('ab',hue),
			makeCell('ab',hue,makeChangeset('2023-05-07',10101))
		)
		const row=new ItemRow($row)
		assert.deepEqual(row.getBoundarySequencePoints(),[
			makeChangesetPoint('2023-05-09',10103),
			makeChangesetPoint('2023-05-07',10101)
		])
	})
	it("gets item sequence of empty collection",()=>{
		const $row=makeRow(
			makeCell('ab',hue)
		)
		const row=new ItemRow($row)
		const result=[...row.getItemSequence()]
		assert.deepEqual(result,[])
	})
	it("gets item sequence of 1-item collection",()=>{
		const $row=makeRow(
			makeCell('ab',hue,
				makeChangeset('2023-04-01',10001)
			)
		)
		const row=new ItemRow($row)
		const result=[...row.getItemSequence()]
		assert.deepEqual(result,[
			[makeChangesetPoint('2023-04-01',10001),[
				[0,$row.cells[1].children[0].children[1]],
			]],
		])
	})
	it("gets item sequence of 2-item collection",()=>{
		const $row=makeRow(
			makeCell('ab',hue,
				makeChangeset('2023-04-02',10002),
				makeChangeset('2023-04-01',10001)
			)
		)
		const row=new ItemRow($row)
		const result=[...row.getItemSequence()]
		assert.deepEqual(result,[
			[makeChangesetPoint('2023-04-02',10002),[
				[0,$row.cells[1].children[0].children[1]],
			]],
			[makeChangesetPoint('2023-04-01',10001),[
				[0,$row.cells[1].children[0].children[2]],
			]],
		])
	})
	it("gets item sequence of 2-column same-item collection",()=>{
		const $row=makeRow(
			makeCell('ab',hue,
				makeChangeset('2023-04-03',10003)
			),makeCell('ab',hue,
				makeChangeset('2023-04-03',10003)
			)
		)
		const row=new ItemRow($row)
		const result=[...row.getItemSequence()]
		assert.deepEqual(result,[
			[makeChangesetPoint('2023-04-03',10003),[
				[0,$row.cells[1].children[0].children[1]],
				[1,$row.cells[2].children[0].children[1]],
			]],
		])
	})
	it("gets item sequence of 2-column different-item collection",()=>{
		const $row=makeRow(
			makeCell('ab',hue,
				makeChangeset('2023-04-03',10003)
			),makeCell('ab',hue,
				makeChangeset('2023-04-04',10004)
			)
		)
		const row=new ItemRow($row)
		const result=[...row.getItemSequence()]
		assert.deepEqual(result,[
			[makeChangesetPoint('2023-04-04',10004),[
				[1,$row.cells[2].children[0].children[1]],
			]],
			[makeChangesetPoint('2023-04-03',10003),[
				[0,$row.cells[1].children[0].children[1]],
			]],
		])
	})
})
