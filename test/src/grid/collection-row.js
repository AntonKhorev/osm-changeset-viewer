import {strict as assert} from 'assert'
import {setupTestHooks, makeRow, makeCell, makeChangeset, makeChangesetPoint} from '../../grid.js'
import ItemCollectionRow from '../../../test-build/grid/collection-row.js'

const hue='--hue: 123;'

describe("ItemCollectionRow",()=>{
	setupTestHooks()
	it("splits single-cell collection",()=>{
		const $row=makeRow(makeCell('ab',hue,
			makeChangeset('2023-05-09',10103),
			makeChangeset('2023-05-07',10101)
		))
		const row=new ItemCollectionRow($row)
		const $splitRow=row.split(makeChangesetPoint('2023-05-08',10102)).$row
		assertChangesetCollectionRow($row,[
			['ab',hue,['2023-05-09',10103]]
		])
		assertChangesetCollectionRow($splitRow,[
			['ab',hue,['2023-05-07',10101]]
		])
	})
	it("splits single-cell collection with terminating timeline",()=>{
		const $row=makeRow(makeCell('a',hue,
			makeChangeset('2023-05-09',10103),
			makeChangeset('2023-05-07',10101)
		))
		const row=new ItemCollectionRow($row)
		const $splitRow=row.split(makeChangesetPoint('2023-05-08',10102)).$row
		assertChangesetCollectionRow($row,[
			['ab',hue,['2023-05-09',10103]]
		])
		assertChangesetCollectionRow($splitRow,[
			['a',hue,['2023-05-07',10101]]
		])
	})
	it("splits 2-cell collection",()=>{
		const $row=makeRow(
			makeCell('ab',hue,makeChangeset('2023-05-09',10103)),
			makeCell('ab',hue,makeChangeset('2023-05-07',10101))
		)
		const row=new ItemCollectionRow($row)
		const $splitRow=row.split(makeChangesetPoint('2023-05-08',10102)).$row
		assertChangesetCollectionRow($row,[
			['ab',hue,['2023-05-09',10103]],
			['ab',hue]
		])
		assertChangesetCollectionRow($splitRow,[
			['ab',hue],
			['ab',hue,['2023-05-07',10101]]
		])
	})
	it("splits collection with one filled and one blank cell without timeline",()=>{
		const $row=makeRow(
			makeCell('ab',hue,
				makeChangeset('2023-05-09',10103),
				makeChangeset('2023-05-07',10101)
			),makeCell('',hue)
		)
		const row=new ItemCollectionRow($row)
		const $splitRow=row.split(makeChangesetPoint('2023-05-08',10102)).$row
		assertChangesetCollectionRow($row,[
			['ab',hue,['2023-05-09',10103]],
			['  ',hue]
		])
		assertChangesetCollectionRow($splitRow,[
			['ab',hue,['2023-05-07',10101]],
			['  ',hue]
		])
	})
	it("splits 2-cell collection with timeline end and one blank cell after split",()=>{
		const $row=makeRow(
			makeCell('a',hue,
				makeChangeset('2023-05-09',10103),
				makeChangeset('2023-05-07',10101)
			),makeCell('a',hue,
				makeChangeset('2023-05-10',10104)
			)
		)
		const row=new ItemCollectionRow($row)
		const $splitRow=row.split(makeChangesetPoint('2023-05-08',10102)).$row
		assertChangesetCollectionRow($row,[
			['ab',hue,['2023-05-09',10103]],
			['a ',hue,['2023-05-10',10104]]
		])
		assertChangesetCollectionRow($splitRow,[
			['a ',hue,['2023-05-07',10101]],
			['  ',hue]
		])
	})
	it("merges with timeline-terminating row",()=>{
		const $row1=makeRow(makeCell('ab',hue,makeChangeset('2023-05-09',10103)))
		const $row2=makeRow(makeCell('a ',hue,makeChangeset('2023-05-08',10102)))
		const row1=new ItemCollectionRow($row1)
		const row2=new ItemCollectionRow($row2)
		row1.merge(row2)
		assertChangesetCollectionRow($row1,[
			['a',hue,['2023-05-09',10103],['2023-05-08',10102]],
		])
	})
	it("merges with empty cells in different columns",()=>{
		const $row1=makeRow(
			makeCell('ab',hue,makeChangeset('2023-05-09',10103)),
			makeCell('ab',hue)
		)
		const $row2=makeRow(
			makeCell('ab',hue),
			makeCell('ab',hue,makeChangeset('2023-05-08',10102))
		)
		const row1=new ItemCollectionRow($row1)
		const row2=new ItemCollectionRow($row2)
		row1.merge(row2)
		assertChangesetCollectionRow($row1,[
			['ab',hue,['2023-05-09',10103]],
			['ab',hue,['2023-05-08',10102]],
		])
	})
	it("inserts item at the beginning of one cell",()=>{
		const $row=makeRow(
			makeCell('a',hue,makeChangeset('2023-03-01',10001))
		)
		const row=new ItemCollectionRow($row)
		row.insert(makeChangesetPoint('2023-03-02',10002),[0],[makeChangeset('2023-03-02',10002)])
		assertChangesetCollectionRow($row,[
			['a',hue,['2023-03-02',10002],['2023-03-01',10001]]
		])
	})
	it("inserts item at the end of one cell in 2-cell row",()=>{
		const $row=makeRow(
			makeCell('ab',hue,makeChangeset('2023-05-09',10103)),
			makeCell('ab',hue,makeChangeset('2023-05-07',10101))
		)
		const row=new ItemCollectionRow($row)
		row.insert(makeChangesetPoint('2023-05-08',10102),[0],[makeChangeset('2023-05-08',10102)])
		assertChangesetCollectionRow($row,[
			['ab',hue,['2023-05-09',10103],['2023-05-08',10102]],
			['ab',hue,['2023-05-07',10101]]
		])
	})
	it("removes items from different 1-item cells",()=>{
		const $row=makeRow(
			makeCell('ab',hue,
				makeChangeset('2023-02-02',10202),
				makeChangeset('2023-01-01',10101)
			),makeCell('ab',hue,
				makeChangeset('2023-02-02',10202),
				makeChangeset('2023-01-01',10101)
			)
		)
		const $items=[...$row.querySelectorAll('.item[data-id="10101"]')]
		const row=new ItemCollectionRow($row)
		row.remove($items)
		assertChangesetCollectionRow($row,[
			['ab',hue,['2023-02-02',10202]],
			['ab',hue,['2023-02-02',10202]],
		])
	})
})

function assertChangesetCollectionRow($row,cells) {
	assert($row.classList.contains('collection'))
	assert.equal($row.cells.length,cells.length+1)
	for (let i=0;i<cells.length-1;i++) {
		const $cell=$row.cells[i+1]
		const [timeline,style,...items]=cells[i]
		assertTimelineClasses($cell,timeline,`cell[${i}]`)
		assert.equal($cell.getAttribute('style'),style)
		assert.equal($cell.children.length,1)
		const [$container]=$cell.children
		if (items.length==0) {
			assert.equal($container.children.length,0)
			continue
		}
		assert.equal($container.childNodes.length,1+2*items.length,`Expected cell[${i}] to have ${1+2*items.length} child nodes, got ${$container.childNodes.length}`)
		const $icon=$container.children[0]
		assert($icon.classList.contains('icon'))
		for (let j=0;j<items.length;j++) {
			const $space=$container.childNodes[1+j*2]
			assert.equal($space.nodeType,document.TEXT_NODE)
			assert.equal($space.textContent,' ')
			const $item=$container.childNodes[2+j*2]
			assert.equal($item.nodeType,document.ELEMENT_NODE)
			const point=makeChangesetPoint(...items[j])
			assert.equal($item.dataset.type,point.type)
			assert.equal($item.dataset.id,String(point.id),`Expected item[${i},${j}] to have id '${point.id}', got '${$item.dataset.id}'`)
			assert.equal($item.dataset.timestamp,String(point.timestamp))
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
