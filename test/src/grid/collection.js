import {strict as assert} from 'assert'
import {JSDOM} from 'jsdom'
import GridBodyCollectionRow from '../../../test-build/grid/collection.js'

function row(contents) {
	const $row=document.createElement('tr')
	$row.classList.add('collection')
	$row.innerHTML=contents
	return $row
}
function cell(timeline,style,contents='') {
	const classList=[]
	if (timeline.includes('a')) classList.push('with-timeline-above')
	if (timeline.includes('b')) classList.push('with-timeline-below')
	return `<td class="${classList.join(' ')}" style="${style}"><span class="icon"></span>${contents}</td>`
}
function changeset(date,id) {
	return `<span class="item changeset combined" data-timestamp="${Date.parse(date)}" data-type="changeset" data-id="${id}"></span>`
}

function changesetPoint(date,id) {
	return {
		timestamp: Date.parse(date),
		type: 'changeset',
		id,
	}
}

const hue='--hue: 123;'

describe("GridBodyCollectionRow",()=>{
	const globalProperties=[
		'document',
		'HTMLElement',
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
	it("gets boundary points of empty collection",()=>{
		const $row=row(cell('',hue))
		const collection=new GridBodyCollectionRow($row)
		assert.deepEqual(collection.getBoundarySequencePoints(),[
			null,
			null
		])
	})
	it("gets boundary points of single-element collection",()=>{
		const $row=row(cell('ab',hue,changeset('2023-05-07',10101)))
		const collection=new GridBodyCollectionRow($row)
		assert.deepEqual(collection.getBoundarySequencePoints(),[
			changesetPoint('2023-05-07',10101),
			changesetPoint('2023-05-07',10101)
		])
	})
	it("gets boundary points of 2-element collection",()=>{
		const $row=row(cell('ab',hue,
			changeset('2023-05-08',10102)+
			changeset('2023-05-07',10101)
		))
		const collection=new GridBodyCollectionRow($row)
		assert.deepEqual(collection.getBoundarySequencePoints(),[
			changesetPoint('2023-05-08',10102),
			changesetPoint('2023-05-07',10101)
		])
	})
	it("gets boundary points of 2-column 2-element collection",()=>{
		const $row=row(
			cell('ab',hue,changeset('2023-05-09',10103))+
			cell('ab',hue,changeset('2023-05-07',10101))
		)
		const collection=new GridBodyCollectionRow($row)
		assert.deepEqual(collection.getBoundarySequencePoints(),[
			changesetPoint('2023-05-09',10103),
			changesetPoint('2023-05-07',10101)
		])
	})
	it("gets boundary points of 2-element collection with empty cell",()=>{
		const $row=row(
			cell('ab',hue,changeset('2023-05-09',10103))+
			cell('ab',hue)+
			cell('ab',hue,changeset('2023-05-07',10101))
		)
		const collection=new GridBodyCollectionRow($row)
		assert.deepEqual(collection.getBoundarySequencePoints(),[
			changesetPoint('2023-05-09',10103),
			changesetPoint('2023-05-07',10101)
		])
	})
	it("splits single-cell collection",()=>{
		const $row=row(cell('ab',hue,
			changeset('2023-05-09',10103)+
			changeset('2023-05-07',10101)
		))
		const collection=new GridBodyCollectionRow($row)
		const $splitRow=collection.split(changesetPoint('2023-05-08',10102))
		assertChangesetCollectionRow($row,[
			['ab',hue,['2023-05-09',10103]]
		])
		assertChangesetCollectionRow($splitRow,[
			['ab',hue,['2023-05-07',10101]]
		])
	})
	it("splits single-cell collection with terminating timeline",()=>{
		const $row=row(cell('a',hue,
			changeset('2023-05-09',10103)+
			changeset('2023-05-07',10101)
		))
		const collection=new GridBodyCollectionRow($row)
		const $splitRow=collection.split(changesetPoint('2023-05-08',10102))
		assertChangesetCollectionRow($row,[
			['ab',hue,['2023-05-09',10103]]
		])
		assertChangesetCollectionRow($splitRow,[
			['a',hue,['2023-05-07',10101]]
		])
	})
	it("splits 2-cell collection",()=>{
		const $row=row(
			cell('ab',hue,changeset('2023-05-09',10103))+
			cell('ab',hue,changeset('2023-05-07',10101))
		)
		const collection=new GridBodyCollectionRow($row)
		const $splitRow=collection.split(changesetPoint('2023-05-08',10102))
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
				changeset('2023-05-09',10103)+
				changeset('2023-05-07',10101)
			)+cell('',hue)
		)
		const collection=new GridBodyCollectionRow($row)
		const $splitRow=collection.split(changesetPoint('2023-05-08',10102))
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
				changeset('2023-05-09',10103)+
				changeset('2023-05-07',10101)
			)+cell('a',hue,
				changeset('2023-05-10',10104)
			)
		)
		const collection=new GridBodyCollectionRow($row)
		const $splitRow=collection.split(changesetPoint('2023-05-08',10102))
		assertChangesetCollectionRow($row,[
			['ab',hue,['2023-05-09',10103]],
			['a ',hue,['2023-05-10',10104]]
		])
		assertChangesetCollectionRow($splitRow,[
			['a ',hue,['2023-05-07',10101]],
			['  ',hue]
		])
	})
	it("inserts placeholder at the beginning of one cell",()=>{
		const $row=row(
			cell('a',hue,changeset('2023-03-01',10001))
		)
		const collection=new GridBodyCollectionRow($row)
		const $placeholders=collection.insert(changesetPoint('2023-03-02',10002),[0])
		assertChangesetCollectionRow($row,[
			['a',hue,['2023-03-02',10002],['2023-03-01',10001]]
		])
		assert.equal($placeholders.length,1)
		assert.equal($placeholders[0].dataset.id,'10002')
	})
	it("inserts placeholder at the end of one cell in 2-cell row",()=>{
		const $row=row(
			cell('ab',hue,changeset('2023-05-09',10103))+
			cell('ab',hue,changeset('2023-05-07',10101))
		)
		const collection=new GridBodyCollectionRow($row)
		const $placeholders=collection.insert(changesetPoint('2023-05-08',10102),[0])
		assertChangesetCollectionRow($row,[
			['ab',hue,['2023-05-09',10103],['2023-05-08',10102]],
			['ab',hue,['2023-05-07',10101]]
		])
		assert.equal($placeholders.length,1)
		assert.equal($placeholders[0].dataset.id,'10102')
	})
	it("gets item sequence of empty collection",()=>{
		const $row=row(
			cell('ab',hue)
		)
		const collection=new GridBodyCollectionRow($row)
		const result=[...collection.getItemSequence()]
		assert.deepEqual(result,[])
	})
	it("gets item sequence of 1-item collection",()=>{
		const $row=row(
			cell('ab',hue,
				changeset('2023-04-01',10001)
			)
		)
		const collection=new GridBodyCollectionRow($row)
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
				changeset('2023-04-02',10002)+
				changeset('2023-04-01',10001)
			)
		)
		const collection=new GridBodyCollectionRow($row)
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
			)+cell('ab',hue,
				changeset('2023-04-03',10003)
			)
		)
		const collection=new GridBodyCollectionRow($row)
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
			)+cell('ab',hue,
				changeset('2023-04-04',10004)
			)
		)
		const collection=new GridBodyCollectionRow($row)
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
		assert.equal($cell.children.length,items.length+1)
		const $iconCell=$cell.children[0]
		assert($iconCell.classList.contains('icon'))
		for (let j=0;j<items.length;j++) {
			const $item=$cell.children[j+1]
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
