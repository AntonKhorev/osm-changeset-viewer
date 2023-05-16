import {strict as assert} from 'assert'
import {JSDOM} from 'jsdom'
import GridBody from '../../../test-build/grid/body.js'

const server={
	web: {
		getUrl: path=>`https://www.openstreetmap.org/`+path
	},
	api: {
		getUrl: path=>`https://api.openstreetmap.org/api/0.6/`+path
	}
}

const usernames=new Map([
	[101, `User One`],
	[102, `User Two`],
])

function assertElementClassType($e,classType) {
	const classTypes=[
		'changeset','note','comment'
	]
	for (const t of classTypes) {
		assert((t!=classType)^($e.classList.contains(t)))
	}
}

function assertRowIsSeparator($row) {
	assert($row.classList.contains('separator'))
	assert(!$row.classList.contains('collection'))
	assert(!$row.classList.contains('item'))
}
function assertRowIsCollection($row) {
	assert(!$row.classList.contains('separator'))
	assert($row.classList.contains('collection'))
	assert(!$row.classList.contains('item'))
}
function assertRowIsItem($row) {
	assert(!$row.classList.contains('separator'))
	assert(!$row.classList.contains('collection'))
	assert($row.classList.contains('item'))
}

function assertCellChildIsIcon($e) {
	assert($e.classList.contains('icon'))
	assert(!$e.classList.contains('item'))
}
function assertCellChildIsItem($e) {
	assert(!$e.classList.contains('icon'))
	assert($e.classList.contains('item'))
}

function assertSeparatorData($separator,year,month) {
	assert.equal($separator.dataset.type,'separator')
	const timestamp=Number($separator.dataset.timestamp)
	assert(Number.isInteger(timestamp))
	const date=new Date(timestamp)
	assert.equal(date.getUTCFullYear(),year)
	assert.equal(date.getUTCMonth()+1,month)
}
function assertItemData($item,timestamp,type,id,order) {
	assert.equal($item.dataset.timestamp,String(timestamp))
	assert.equal($item.dataset.type,type)
	assert.equal($item.dataset.id,String(id))
	if (order!=null) {
		assert.equal($item.dataset.order,String(order))
	} else {
		assert.equal($item.dataset.order,undefined)
	}
}

function assertEach(xs,...fns) {
	assert.equal(xs.length,fns.length)
	for (const [i,fn] of fns.entries()) {
		fn(xs[i])
	}
}

describe("GridBody",()=>{
	const globalProperties=[
		'document',
		'HTMLElement',
		'HTMLButtonElement',
		'HTMLInputElement',
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
	it("creates empty table body",()=>{
		const nColumns=1
		const getColumnHues=()=>new Array(nColumns).fill(0)
		const gridBody=new GridBody(
			server,null,getColumnHues
		)
		gridBody.setColumns(nColumns)
		assert.equal(gridBody.$gridBody.rows.length,0)
	})
	it("adds one expanded item",()=>{
		const nColumns=1
		const getColumnHues=()=>new Array(nColumns).fill(0)
		const gridBody=new GridBody(
			server,null,getColumnHues
		)
		gridBody.setColumns(nColumns)
		gridBody.addItem({
			iColumns: [0],
			type: 'changeset',
			item: {
				id: 10001,
				uid: 101,
				createdAt: new Date('2023-03'),
				tags: {},
				closedAt: new Date('2023-03'),
				comments: {count:0},
				changes: {count:1},
				bbox: {
					minLat: 60.0,
					minLon: 30.0,
					maxLat: 60.1,
					maxLon: 30.1,
				},
			},
		},usernames,true)
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertItemData($row,Date.parse('2023-03'),'changeset',10001)
		})
	})
	it("adds one collapsed item",()=>{
		const nColumns=1
		const getColumnHues=()=>new Array(nColumns).fill(0)
		const gridBody=new GridBody(
			server,null,getColumnHues
		)
		gridBody.setColumns(nColumns)
		gridBody.addItem({
			iColumns: [0],
			type: 'changeset',
			item: {
				id: 10001,
				uid: 101,
				createdAt: new Date('2023-03'),
				tags: {},
				closedAt: new Date('2023-03'),
				comments: {count:0},
				changes: {count:1},
				bbox: {
					minLat: 60.0,
					minLon: 30.0,
					maxLat: 60.1,
					maxLon: 30.1,
				},
			},
		},usernames,false)
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>{
			assertRowIsCollection($row)
			assertEach($row.cells,$cell=>{
				assertEach($cell.children,$child=>{
					assertCellChildIsIcon($child)
				},$child=>{
					assertCellChildIsItem($child)
					assertElementClassType($child,'changeset')
					assertItemData($child,Date.parse('2023-03'),'changeset',10001)
				})
			})
		})
	})
})
