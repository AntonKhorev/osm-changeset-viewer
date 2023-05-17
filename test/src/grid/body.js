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

function makeChangesetItem(i,createdAtString,closedAtString) {
	const createdAt=new Date(createdAtString
		? new Date(createdAtString)
		: `2023-03-0${i}`
	)
	const closedAt=new Date(closedAtString
		? new Date(closedAtString)
		: `2023-03-0${i}`
	)
	return {
		id: 10000+i,
		uid: 101,
		createdAt,
		tags: {},
		closedAt,
		comments: {count:0},
		changes: {count:1},
		bbox: {
			minLat: 60.0,
			minLon: 30.0,
			maxLat: 60.1,
			maxLon: 30.1,
		},
	}
}
function makeChangesetBatchItem(i,createdAtString,closedAtString) {
	return {
		iColumns: [0],
		type: 'changeset',
		item: makeChangesetItem(i,createdAtString,closedAtString),
	}
}
function makeChangesetCloseBatchItem(i,createdAtString,closedAtString) {
	return {
		iColumns: [0],
		type: 'changesetClose',
		item: makeChangesetItem(i,createdAtString,closedAtString),
	}
}

function makeSingleColumnGrid(itemReader) {
	const nColumns=1
	const getColumnHues=()=>new Array(nColumns).fill(0)
	const gridBody=new GridBody(
		server,itemReader,getColumnHues
	)
	gridBody.setColumns(nColumns)
	return gridBody
}

describe("GridBody",()=>{
	const globalProperties=[
		'document',
		'HTMLElement',
		'HTMLButtonElement',
		'HTMLInputElement',
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
	it("creates empty table body",()=>{
		const gridBody=makeSingleColumnGrid()
		assert.equal(gridBody.$gridBody.rows.length,0)
	})
	it("adds 1 expanded item",()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetBatchItem(1),usernames,true)
		gridBody.updateTableAccordingToSettings(false,false)
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertItemData($row,Date.parse('2023-03-01'),'changeset',10001)
		})
	})
	it("adds 1 collapsed item",()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAccordingToSettings(false,false)
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
					assertItemData($child,Date.parse('2023-03-01'),'changeset',10001)
				})
			})
		})
	})
	it("adds 2 collapsed items",()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetBatchItem(2),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAccordingToSettings(false,false)
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
					assertItemData($child,Date.parse('2023-03-02'),'changeset',10002)
				},$child=>{
					assertCellChildIsItem($child)
					assertElementClassType($child,'changeset')
					assertItemData($child,Date.parse('2023-03-01'),'changeset',10001)
				})
			})
		})
	})
	it("adds 2 collapsed items in reverse order",()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(2),usernames,false)
		gridBody.updateTableAccordingToSettings(false,false)
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
					assertItemData($child,Date.parse('2023-03-02'),'changeset',10002)
				},$child=>{
					assertCellChildIsItem($child)
					assertElementClassType($child,'changeset')
					assertItemData($child,Date.parse('2023-03-01'),'changeset',10001)
				})
			})
		})
	})
	it("expands 1 item from collection of 1 item",async()=>{
		const gridBody=makeSingleColumnGrid({
			getChangeset: async()=>makeChangesetItem(1)
		})
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAccordingToSettings(false,false)
		await gridBody.expandItem(['changeset',10001])
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertItemData($row,Date.parse('2023-03-01'),'changeset',10001)
		})
	})
	it("expands 1st item from collection of 2 items",async()=>{
		const gridBody=makeSingleColumnGrid({
			getChangeset: async()=>makeChangesetItem(2)
		})
		gridBody.addItem(makeChangesetBatchItem(2),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAccordingToSettings(false,false)
		await gridBody.expandItem(['changeset',10002])
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertItemData($row,Date.parse('2023-03-02'),'changeset',10002)
		},$row=>{
			assertRowIsCollection($row)
			assertEach($row.cells,$cell=>{
				assertEach($cell.children,$child=>{
					assertCellChildIsIcon($child)
				},$child=>{
					assertCellChildIsItem($child)
					assertElementClassType($child,'changeset')
					assertItemData($child,Date.parse('2023-03-01'),'changeset',10001)
				})
			})
		})
	})
	it("expands 2nd item from collection of 2 items",async()=>{
		const gridBody=makeSingleColumnGrid({
			getChangeset: async()=>makeChangesetItem(1)
		})
		gridBody.addItem(makeChangesetBatchItem(2),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAccordingToSettings(false,false)
		await gridBody.expandItem(['changeset',10001])
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
					assertItemData($child,Date.parse('2023-03-02'),'changeset',10002)
				})
			})
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertItemData($row,Date.parse('2023-03-01'),'changeset',10001)
		})
	})
	it("merges two collections when collapsing item between them",()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetBatchItem(3),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(2),usernames,true)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAccordingToSettings(false,false)
		gridBody.collapseItem(['changeset',10002])
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
					assertItemData($child,Date.parse('2023-03-03'),'changeset',10003)
				},$child=>{
					assertCellChildIsItem($child)
					assertElementClassType($child,'changeset')
					assertItemData($child,Date.parse('2023-03-02'),'changeset',10002)
				},$child=>{
					assertCellChildIsItem($child)
					assertElementClassType($child,'changeset')
					assertItemData($child,Date.parse('2023-03-01'),'changeset',10001)
				})
			})
		})
	})
	for (const [actionName,withClosedChangesetsValue] of [[`hide`,false],[`show`,true]]) {
		it(`combines consecutive opened+closed changesets when asked to ${actionName} closed`,()=>{
			const gridBody=makeSingleColumnGrid()
			gridBody.addItem(makeChangesetCloseBatchItem(1),usernames,true)
			gridBody.addItem(makeChangesetBatchItem(1),usernames,true)
			gridBody.updateTableAccordingToSettings(false,withClosedChangesetsValue)
			assertEach(gridBody.$gridBody.rows,$row=>{
				assertRowIsSeparator($row)
				assertSeparatorData($row,2023,3)
			},$row=>{
				assertRowIsItem($row)
				assertElementClassType($row,'changeset')
				assertChangesetClassTypes($row,['closed','hidden'])
				assertItemData($row,Date.parse('2023-03-01'),'changesetClose',10001)
			},$row=>{
				assertRowIsItem($row)
				assertElementClassType($row,'changeset')
				assertChangesetClassTypes($row,['combined'])
				assertItemData($row,Date.parse('2023-03-01'),'changeset',10001)
			})
		})
	}
	it(`combines interleaving opened+closed changesets when asked to hide closed`,()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetCloseBatchItem(2,'2023-03-02','2023-03-04'),usernames,true)
		gridBody.addItem(makeChangesetCloseBatchItem(1,'2023-03-01','2023-03-03'),usernames,true)
		gridBody.addItem(makeChangesetBatchItem(2,'2023-03-02','2023-03-04'),usernames,true)
		gridBody.addItem(makeChangesetBatchItem(1,'2023-03-01','2023-03-03'),usernames,true)
		gridBody.updateTableAccordingToSettings(false,false)
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertChangesetClassTypes($row,['closed','hidden'])
			assertItemData($row,Date.parse('2023-03-04'),'changesetClose',10002)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertChangesetClassTypes($row,['closed','hidden'])
			assertItemData($row,Date.parse('2023-03-03'),'changesetClose',10001)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertChangesetClassTypes($row,['combined'])
			assertItemData($row,Date.parse('2023-03-02'),'changeset',10002)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertChangesetClassTypes($row,['combined'])
			assertItemData($row,Date.parse('2023-03-01'),'changeset',10001)
		})
	})
})

function assertElementClass($e,t,isExpectedClass,name) {
	if (isExpectedClass) {
		assert($e.classList.contains(t),`${name} doesn't contain expected class ${t}`)
	} else {
		assert(!$e.classList.contains(t),`${name} contains unexpected class ${t}`)
	}
}
function assertElementClassType($e,classType) {
	const allClassTypes=[
		'changeset','note','comment'
	]
	for (const t of allClassTypes) {
		const isExpectedClass=t==classType
		assertElementClass($e,t,isExpectedClass,`Element`)
	}
}
function assertChangesetClassTypes($e,classTypes) {
	const allClassTypes=[
		'combined','closed','hidden'
	]
	for (const t of allClassTypes) {
		const isExpectedClass=classTypes.includes(t)
		assertElementClass($e,t,isExpectedClass,`Changeset`)
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
	assert.equal(xs.length,fns.length,`Expected sequence to have ${fns.length} element(s), got ${xs.length} instead`)
	for (const [i,fn] of fns.entries()) {
		fn(xs[i])
	}
}
