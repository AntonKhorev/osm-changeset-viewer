import {strict as assert} from 'assert'
import {JSDOM} from 'jsdom'
import ItemCollection from '../../../test-build/grid/collection.js'

function row(...$cells) {
	const $row=document.createElement('tr')
	$row.classList.add('collection')
	$row.append(...$cells)
	return $row
}
function cell(timeline,style,...$children) {
	const $cell=document.createElement('td')
	if (timeline.includes('a')) $cell.classList.add('with-timeline-above')
	if (timeline.includes('b')) $cell.classList.add('with-timeline-below')
	$cell.setAttribute('style',style)
	if ($children.length>0) {
		const $icon=document.createElement('span')
		$icon.classList.add('icon')
		$cell.append($icon)
	}
	for (const $child of $children) {
		$cell.append(' ',$child)
	}
	return $cell
}
function changeset(date,id) {
	const $changeset=document.createElement('span')
	$changeset.classList.add('item','changeset','combined')
	$changeset.dataset.timestamp=Date.parse(date)
	$changeset.dataset.type='changeset'
	$changeset.dataset.id=id
	return $changeset
}

function changesetPoint(date,id) {
	return {
		timestamp: Date.parse(date),
		type: 'changeset',
		id,
	}
}

const hue='--hue: 123;'

describe("ItemCollection",()=>{
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
		const $row=row(cell('',hue))
		const collection=new ItemCollection($row)
		assert.equal(collection.isEmpty(),true)
	})
	it("reports nonempty collection",()=>{
		const $row=row(cell('ab',hue,changeset('2023-05-07',10101)))
		const collection=new ItemCollection($row)
		assert.equal(collection.isEmpty(),false)
	})
	it("gets boundary points of empty collection",()=>{
		const $row=row(cell('',hue))
		const collection=new ItemCollection($row)
		assert.deepEqual(collection.getBoundarySequencePoints(),[
			null,
			null
		])
	})
	it("gets boundary points of single-element collection",()=>{
		const $row=row(cell('ab',hue,changeset('2023-05-07',10101)))
		const collection=new ItemCollection($row)
		assert.deepEqual(collection.getBoundarySequencePoints(),[
			changesetPoint('2023-05-07',10101),
			changesetPoint('2023-05-07',10101)
		])
	})
	it("gets boundary points of 2-element collection",()=>{
		const $row=row(cell('ab',hue,
			changeset('2023-05-08',10102),
			changeset('2023-05-07',10101)
		))
		const collection=new ItemCollection($row)
		assert.deepEqual(collection.getBoundarySequencePoints(),[
			changesetPoint('2023-05-08',10102),
			changesetPoint('2023-05-07',10101)
		])
	})
	it("gets boundary points of 2-column 2-element collection",()=>{
		const $row=row(
			cell('ab',hue,changeset('2023-05-09',10103)),
			cell('ab',hue,changeset('2023-05-07',10101))
		)
		const collection=new ItemCollection($row)
		assert.deepEqual(collection.getBoundarySequencePoints(),[
			changesetPoint('2023-05-09',10103),
			changesetPoint('2023-05-07',10101)
		])
	})
	it("gets boundary points of 2-element collection with empty cell",()=>{
		const $row=row(
			cell('ab',hue,changeset('2023-05-09',10103)),
			cell('ab',hue),
			cell('ab',hue,changeset('2023-05-07',10101))
		)
		const collection=new ItemCollection($row)
		assert.deepEqual(collection.getBoundarySequencePoints(),[
			changesetPoint('2023-05-09',10103),
			changesetPoint('2023-05-07',10101)
		])
	})
	it("splits single-cell collection",()=>{
		const $row=row(cell('ab',hue,
			changeset('2023-05-09',10103),
			changeset('2023-05-07',10101)
		))
		const collection=new ItemCollection($row)
		const $splitRow=collection.split(changesetPoint('2023-05-08',10102)).$row
		assertChangesetCollectionRow($row,[
			['ab',hue,['2023-05-09',10103]]
		])
		assertChangesetCollectionRow($splitRow,[
			['ab',hue,['2023-05-07',10101]]
		])
	})
	it("splits single-cell collection with terminating timeline",()=>{
		const $row=row(cell('a',hue,
			changeset('2023-05-09',10103),
			changeset('2023-05-07',10101)
		))
		const collection=new ItemCollection($row)
		const $splitRow=collection.split(changesetPoint('2023-05-08',10102)).$row
		assertChangesetCollectionRow($row,[
			['ab',hue,['2023-05-09',10103]]
		])
		assertChangesetCollectionRow($splitRow,[
			['a',hue,['2023-05-07',10101]]
		])
	})
	it("splits 2-cell collection",()=>{
		const $row=row(
			cell('ab',hue,changeset('2023-05-09',10103)),
			cell('ab',hue,changeset('2023-05-07',10101))
		)
		const collection=new ItemCollection($row)
		const $splitRow=collection.split(changesetPoint('2023-05-08',10102)).$row
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
		const $row=row(
			cell('ab',hue,
				changeset('2023-05-09',10103),
				changeset('2023-05-07',10101)
			),cell('',hue)
		)
		const collection=new ItemCollection($row)
		const $splitRow=collection.split(changesetPoint('2023-05-08',10102)).$row
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
		const $row=row(
			cell('a',hue,
				changeset('2023-05-09',10103),
				changeset('2023-05-07',10101)
			),cell('a',hue,
				changeset('2023-05-10',10104)
			)
		)
		const collection=new ItemCollection($row)
		const $splitRow=collection.split(changesetPoint('2023-05-08',10102)).$row
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
		const $row1=row(cell('ab',hue,changeset('2023-05-09',10103)))
		const $row2=row(cell('a ',hue,changeset('2023-05-08',10102)))
		const collection1=new ItemCollection($row1)
		const collection2=new ItemCollection($row2)
		collection1.merge(collection2)
		assertChangesetCollectionRow($row1,[
			['a',hue,['2023-05-09',10103],['2023-05-08',10102]],
		])
	})
	it("merges with empty cells in different columns",()=>{
		const $row1=row(
			cell('ab',hue,changeset('2023-05-09',10103)),
			cell('ab',hue)
		)
		const $row2=row(
			cell('ab',hue),
			cell('ab',hue,changeset('2023-05-08',10102))
		)
		const collection1=new ItemCollection($row1)
		const collection2=new ItemCollection($row2)
		collection1.merge(collection2)
		assertChangesetCollectionRow($row1,[
			['ab',hue,['2023-05-09',10103]],
			['ab',hue,['2023-05-08',10102]],
		])
	})
	it("inserts item at the beginning of one cell",()=>{
		const $row=row(
			cell('a',hue,changeset('2023-03-01',10001))
		)
		const collection=new ItemCollection($row)
		collection.insert(changesetPoint('2023-03-02',10002),[0],[changeset('2023-03-02',10002)])
		assertChangesetCollectionRow($row,[
			['a',hue,['2023-03-02',10002],['2023-03-01',10001]]
		])
	})
	it("inserts item at the end of one cell in 2-cell row",()=>{
		const $row=row(
			cell('ab',hue,changeset('2023-05-09',10103)),
			cell('ab',hue,changeset('2023-05-07',10101))
		)
		const collection=new ItemCollection($row)
		collection.insert(changesetPoint('2023-05-08',10102),[0],[changeset('2023-05-08',10102)])
		assertChangesetCollectionRow($row,[
			['ab',hue,['2023-05-09',10103],['2023-05-08',10102]],
			['ab',hue,['2023-05-07',10101]]
		])
	})
	it("removes items from different 1-item cells",()=>{
		const $row=row(
			cell('ab',hue,
				changeset('2023-02-02',10202),
				changeset('2023-01-01',10101)
			),cell('ab',hue,
				changeset('2023-02-02',10202),
				changeset('2023-01-01',10101)
			)
		)
		const $items=[...$row.querySelectorAll('.item[data-id="10101"]')]
		const collection=new ItemCollection($row)
		collection.remove($items)
		assertChangesetCollectionRow($row,[
			['ab',hue,['2023-02-02',10202]],
			['ab',hue,['2023-02-02',10202]],
		])
	})
	it("gets item sequence of empty collection",()=>{
		const $row=row(
			cell('ab',hue)
		)
		const collection=new ItemCollection($row)
		const result=[...collection.getItemSequence()]
		assert.deepEqual(result,[])
	})
	it("gets item sequence of 1-item collection",()=>{
		const $row=row(
			cell('ab',hue,
				changeset('2023-04-01',10001)
			)
		)
		const collection=new ItemCollection($row)
		const result=[...collection.getItemSequence()]
		assert.deepEqual(result,[
			[changesetPoint('2023-04-01',10001),[
				[0,$row.cells[0].children[1]],
			]],
		])
	})
	it("gets item sequence of 2-item collection",()=>{
		const $row=row(
			cell('ab',hue,
				changeset('2023-04-02',10002),
				changeset('2023-04-01',10001)
			)
		)
		const collection=new ItemCollection($row)
		const result=[...collection.getItemSequence()]
		assert.deepEqual(result,[
			[changesetPoint('2023-04-02',10002),[
				[0,$row.cells[0].children[1]],
			]],
			[changesetPoint('2023-04-01',10001),[
				[0,$row.cells[0].children[2]],
			]],
		])
	})
	it("gets item sequence of 2-column same-item collection",()=>{
		const $row=row(
			cell('ab',hue,
				changeset('2023-04-03',10003)
			),cell('ab',hue,
				changeset('2023-04-03',10003)
			)
		)
		const collection=new ItemCollection($row)
		const result=[...collection.getItemSequence()]
		assert.deepEqual(result,[
			[changesetPoint('2023-04-03',10003),[
				[0,$row.cells[0].children[1]],
				[1,$row.cells[1].children[1]],
			]],
		])
	})
	it("gets item sequence of 2-column different-item collection",()=>{
		const $row=row(
			cell('ab',hue,
				changeset('2023-04-03',10003)
			),cell('ab',hue,
				changeset('2023-04-04',10004)
			)
		)
		const collection=new ItemCollection($row)
		const result=[...collection.getItemSequence()]
		assert.deepEqual(result,[
			[changesetPoint('2023-04-04',10004),[
				[1,$row.cells[1].children[1]],
			]],
			[changesetPoint('2023-04-03',10003),[
				[0,$row.cells[0].children[1]],
			]],
		])
	})
})

function assertChangesetCollectionRow($row,cells) {
	assert($row.classList.contains('collection'))
	assert.equal($row.cells.length,cells.length)
	for (let i=0;i<cells.length;i++) {
		const $cell=$row.cells[i]
		const [timeline,style,...items]=cells[i]
		assertTimelineClasses($cell,timeline,`cell[${i}]`)
		assert.equal($cell.getAttribute('style'),style)
		if (items.length==0) {
			assert.equal($cell.children.length,0)
			continue
		}
		assert.equal($cell.childNodes.length,1+2*items.length,`Expected cell[${i}] to have ${1+2*items.length} child nodes, got ${$cell.childNodes.length}`)
		const $icon=$cell.children[0]
		assert($icon.classList.contains('icon'))
		for (let j=0;j<items.length;j++) {
			const $space=$cell.childNodes[1+j*2]
			assert.equal($space.nodeType,document.TEXT_NODE)
			assert.equal($space.textContent,' ')
			const $item=$cell.childNodes[2+j*2]
			assert.equal($item.nodeType,document.ELEMENT_NODE)
			const point=changesetPoint(...items[j])
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
