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

function assertRowIsSeparator($row) {
	assert($row.classList.contains('separator'))
	assert(!$row.classList.contains('collection'))
	assert(!$row.classList.contains('item'))
}

function assertRowIsItem($row) {
	assert(!$row.classList.contains('separator'))
	assert(!$row.classList.contains('collection'))
	assert($row.classList.contains('item'))
}

function assertSeparatorData($row,year,month) {
	assert.equal($row.dataset.type,'separator')
	const timestamp=Number($row.dataset.timestamp)
	assert(Number.isInteger(timestamp))
	const date=new Date(timestamp)
	assert.equal(date.getUTCFullYear(),year)
	assert.equal(date.getUTCMonth()+1,month)
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
		assert.equal(gridBody.$gridBody.rows.length,2)
		assertRowIsSeparator(gridBody.$gridBody.rows[0])
		assertSeparatorData(gridBody.$gridBody.rows[0],2023,3)
		assertRowIsItem(gridBody.$gridBody.rows[1])
	})
})
