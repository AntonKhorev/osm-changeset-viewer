import {strict as assert} from 'assert'
import {JSDOM} from 'jsdom'
import GridBodyCollectionRow from '../../../test-build/grid/collection.js'

function row(contents) {
	const $row=document.createElement('tr')
	$row.classList.add('collection')
	$row.innerHTML=contents
	return $row
}
function cell(timeline,contents) {
	if (!contents) return `<td></td>`
	const classList=[]
	if (timeline.includes('a')) classList.push('with-timeline-above')
	if (timeline.includes('b')) classList.push('with-timeline-below')
	return `<td class="${classList.join(' ')}"><span class="icon"></span>${contents}</td>`
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
	it("compares empty collection as lesser",()=>{
		const $row=row(cell(''))
		const collection=new GridBodyCollectionRow($row)
		const cmp=collection.compare(changesetPoint('2023-04-06',10001))
		assert.equal(cmp,-1)
	})
	it("compares single-element collection as greater",()=>{
		const $row=row(cell('ab',changeset('2023-05-07',10101)))
		const collection=new GridBodyCollectionRow($row)
		const cmp=collection.compare(changesetPoint('2023-04-06',10001))
		assert.equal(cmp,1)
	})
	it("compares single-element collection as lesser",()=>{
		const $row=row(cell('ab',changeset('2023-03-05',9901)))
		const collection=new GridBodyCollectionRow($row)
		const cmp=collection.compare(changesetPoint('2023-04-06',10001))
		assert.equal(cmp,-1)
	})
	it("compares 2-element collection as greater",()=>{
		const $row=row(cell('ab',
			changeset('2023-05-08',10102)+
			changeset('2023-05-07',10101)
		))
		const collection=new GridBodyCollectionRow($row)
		const cmp=collection.compare(changesetPoint('2023-04-06',10001))
		assert.equal(cmp,1)
	})
	it("compares 2-element collection as neither",()=>{
		const $row=row(cell('ab',
			changeset('2023-05-09',10103)+
			changeset('2023-05-07',10101)
		))
		const collection=new GridBodyCollectionRow($row)
		const cmp=collection.compare(changesetPoint('2023-05-08',10102))
		assert.equal(cmp,0)
	})
	it("compares 2-column 2-element collection as neither",()=>{
		const $row=row(
			cell('ab',changeset('2023-05-09',10103))+
			cell('ab',changeset('2023-05-07',10101))
		)
		const collection=new GridBodyCollectionRow($row)
		const cmp=collection.compare(changesetPoint('2023-05-08',10102))
		assert.equal(cmp,0)
	})
	it("compares 2-element collection with empty cell as lesser",()=>{
		const $row=row(
			cell('ab',changeset('2023-05-09',10103))+
			cell('ab')+
			cell('ab',changeset('2023-05-07',10101))
		)
		const collection=new GridBodyCollectionRow($row)
		const cmp=collection.compare(changesetPoint('2023-05-10',10110))
		assert.equal(cmp,-1)
	})
	it("splits single-cell collection",()=>{
		const $row=row(cell('ab',
			changeset('2023-05-09',10103)+
			changeset('2023-05-07',10101)
		))
		const collection=new GridBodyCollectionRow($row)
		const $splitRow=collection.split(changesetPoint('2023-05-08',10102))
		assertChangesetCollectionRow($row,[
			['ab',['2023-05-09',10103]]
		])
		assertChangesetCollectionRow($splitRow,[
			['ab',['2023-05-07',10101]]
		])
	})
	it("splits single-cell collection with terminating timeline",()=>{
		const $row=row(cell('a',
			changeset('2023-05-09',10103)+
			changeset('2023-05-07',10101)
		))
		const collection=new GridBodyCollectionRow($row)
		const $splitRow=collection.split(changesetPoint('2023-05-08',10102))
		assertChangesetCollectionRow($row,[
			['ab',['2023-05-09',10103]]
		])
		assertChangesetCollectionRow($splitRow,[
			['a',['2023-05-07',10101]]
		])
	})
	it("splits 2-cell collection",()=>{
		const $row=row(
			cell('ab',changeset('2023-05-09',10103))+
			cell('ab',changeset('2023-05-07',10101))
		)
		const collection=new GridBodyCollectionRow($row)
		const $splitRow=collection.split(changesetPoint('2023-05-08',10102))
		assertChangesetCollectionRow($row,[
			['ab',['2023-05-09',10103]],
			['ab']
		])
		assertChangesetCollectionRow($splitRow,[
			['ab'],
			['ab',['2023-05-07',10101]]
		])
	})
})

function assertChangesetCollectionRow($row,cells) {
	assert($row.classList.contains('collection'))
	assert.equal($row.cells.length,cells.length)
	for (let i=0;i<cells.length;i++) {
		const $cell=$row.cells[i]
		const [timeline,...items]=cells[i]
		assertTimelineClasses($cell,timeline,`cell[${i}]`)
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
			assert.equal($item.dataset.timestamp,String(point.timestamp))
			assert.equal($item.dataset.type,point.type)
			assert.equal($item.dataset.id,String(point.id))
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
