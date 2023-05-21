import {strict as assert} from 'assert'
import {JSDOM} from 'jsdom'
import GridBodyCollectionRow from '../../../test-build/grid/collection.js'

function row(contents) {
	const $row=document.createElement('tr')
	$row.classList.add('collection')
	$row.innerHTML=contents
	return $row
}
function cell(contents) {
	if (!contents) return `<td></td>`
	return `<td><span class="icon"></span>${contents}</td>`
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
		const $row=row(cell())
		const collection=new GridBodyCollectionRow($row)
		const cmp=collection.compare(changesetPoint('2023-04-06',10001))
		assert.equal(cmp,-1)
	})
	it("compares single-element collection as greater",()=>{
		const $row=row(cell(changeset('2023-05-07',10101)))
		const collection=new GridBodyCollectionRow($row)
		const cmp=collection.compare(changesetPoint('2023-04-06',10001))
		assert.equal(cmp,1)
	})
	it("compares single-element collection as lesser",()=>{
		const $row=row(cell(changeset('2023-03-05',9901)))
		const collection=new GridBodyCollectionRow($row)
		const cmp=collection.compare(changesetPoint('2023-04-06',10001))
		assert.equal(cmp,-1)
	})
	it("compares 2-element collection as greater",()=>{
		const $row=row(cell(
			changeset('2023-05-08',10102)+
			changeset('2023-05-07',10101)
		))
		const collection=new GridBodyCollectionRow($row)
		const cmp=collection.compare(changesetPoint('2023-04-06',10001))
		assert.equal(cmp,1)
	})
	it("compares 2-element collection as neither",()=>{
		const $row=row(cell(
			changeset('2023-05-09',10103)+
			changeset('2023-05-07',10101)
		))
		const collection=new GridBodyCollectionRow($row)
		const cmp=collection.compare(changesetPoint('2023-05-08',10102))
		assert.equal(cmp,0)
	})
	it("compares 2-column 2-element collection as neither",()=>{
		const $row=row(
			cell(changeset('2023-05-09',10103))+
			cell(changeset('2023-05-07',10101))
		)
		const collection=new GridBodyCollectionRow($row)
		const cmp=collection.compare(changesetPoint('2023-05-08',10102))
		assert.equal(cmp,0)
	})
	it("compares 2-element collection with empty cell as lesser",()=>{
		const $row=row(
			cell(changeset('2023-05-09',10103))+
			cell()+
			cell(changeset('2023-05-07',10101))
		)
		const collection=new GridBodyCollectionRow($row)
		const cmp=collection.compare(changesetPoint('2023-05-10',10110))
		assert.equal(cmp,-1)
	})
})
