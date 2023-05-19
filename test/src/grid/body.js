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

const comment0={
	itemId: 10001,
	order: 0,
	itemUid: 101,
	uid: 102,
	createdAt: new Date('2023-05-10'),
	text: `is it right?`
}
const comment1={
	itemId: 10001,
	order: 1,
	itemUid: 101,
	uid: 101,
	createdAt: new Date('2023-05-11'),
	text: `yse it is`
}

const user1={
	id: 101,
	nameUpdatedAt: new Date('2023-05-01'),
	name: `User One`,
	withDetails: true,
	detailsUpdatedAt: new Date('2023-05-01'),
	visible: true,
	createdAt: new Date('2023-01-01'),
	roles: [],
	changesets: {count:12},
	traces: {count:0},
	blocks: {
		received: {count:0,active:0},
	},
}
const user2={
	id: 102,
	nameUpdatedAt: new Date('2023-05-01'),
	name: `User Two`,
	withDetails: false
}

const usernames=new Map([
	[101, user1.name],
	[102, user2.name],
])

function makeChangesetItem(i,createdAtString,closedAtString) {
	const createdAt=new Date(createdAtString
		? createdAtString
		: `2023-03-0${i}`
	)
	const closedAt=new Date(closedAtString
		? closedAtString
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
		},$row=>assertRowIsCollectionWithEach($row,
			$child=>{
				assertElementClassType($child,'changeset')
				assertItemData($child,Date.parse('2023-03-01'),'changeset',10001)
			}
		))
	})
	it("adds 2 collapsed items",()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetBatchItem(2),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAccordingToSettings(false,false)
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithEach($row,
			$child=>{
				assertElementClassType($child,'changeset')
				assertItemData($child,Date.parse('2023-03-02'),'changeset',10002)
			},$child=>{
				assertElementClassType($child,'changeset')
				assertItemData($child,Date.parse('2023-03-01'),'changeset',10001)
			})
		)
	})
	it("adds 2 collapsed items in reverse order",()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(2),usernames,false)
		gridBody.updateTableAccordingToSettings(false,false)
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithEach($row,
			$child=>{
				assertElementClassType($child,'changeset')
				assertItemData($child,Date.parse('2023-03-02'),'changeset',10002)
			},$child=>{
				assertElementClassType($child,'changeset')
				assertItemData($child,Date.parse('2023-03-01'),'changeset',10001)
			})
		)
	})
	it("expands 1 item from collection of 1 item",async()=>{
		const gridBody=makeSingleColumnGrid({
			getChangeset: async()=>makeChangesetItem(1)
		})
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAccordingToSettings(false,false)
		await gridBody.expandItem({type:'changeset',id:10001})
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
		await gridBody.expandItem({type:'changeset',id:10002})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertItemData($row,Date.parse('2023-03-02'),'changeset',10002)
		},$row=>assertRowIsCollectionWithEach($row,
			$child=>{
				assertElementClassType($child,'changeset')
				assertItemData($child,Date.parse('2023-03-01'),'changeset',10001)
			})
		)
	})
	it("expands 2nd item from collection of 2 items",async()=>{
		const gridBody=makeSingleColumnGrid({
			getChangeset: async()=>makeChangesetItem(1)
		})
		gridBody.addItem(makeChangesetBatchItem(2),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAccordingToSettings(false,false)
		await gridBody.expandItem({type:'changeset',id:10001})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithEach($row,
			$child=>{
				assertElementClassType($child,'changeset')
				assertItemData($child,Date.parse('2023-03-02'),'changeset',10002)
			}
		),$row=>{
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
		gridBody.collapseItem({type:'changeset',id:10002})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithEach($row,
			$child=>{
				assertElementClassType($child,'changeset')
				assertItemData($child,Date.parse('2023-03-03'),'changeset',10003)
			},$child=>{
				assertElementClassType($child,'changeset')
				assertItemData($child,Date.parse('2023-03-02'),'changeset',10002)
			},$child=>{
				assertElementClassType($child,'changeset')
				assertItemData($child,Date.parse('2023-03-01'),'changeset',10001)
			})
		)
	})
	for (const [withClosedChangesetsName,withClosedChangesetsValue] of [
		[`hide`,false],
		[`show`,true]
	]) it(`combines consecutive opened+closed changesets when asked to ${withClosedChangesetsName} closed`,()=>{
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
	for (const [withClosedChangesetsName,withClosedChangesetsValue,combineName,openClasses,closedClasses] of [
		[`hide`,false,`combines`,['combined'],['closed','hidden']],
		[`show`,true,`doesn't combine`,[],['closed']]
	]) it(`${combineName} interleaving opened+closed changesets when asked to ${withClosedChangesetsName} closed`,()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetCloseBatchItem(2,'2023-03-02','2023-03-04'),usernames,true)
		gridBody.addItem(makeChangesetCloseBatchItem(1,'2023-03-01','2023-03-03'),usernames,true)
		gridBody.addItem(makeChangesetBatchItem(2,'2023-03-02','2023-03-04'),usernames,true)
		gridBody.addItem(makeChangesetBatchItem(1,'2023-03-01','2023-03-03'),usernames,true)
		gridBody.updateTableAccordingToSettings(false,withClosedChangesetsValue)
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertChangesetClassTypes($row,closedClasses)
			assertItemData($row,Date.parse('2023-03-04'),'changesetClose',10002)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertChangesetClassTypes($row,closedClasses)
			assertItemData($row,Date.parse('2023-03-03'),'changesetClose',10001)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertChangesetClassTypes($row,openClasses)
			assertItemData($row,Date.parse('2023-03-02'),'changeset',10002)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertChangesetClassTypes($row,openClasses)
			assertItemData($row,Date.parse('2023-03-01'),'changeset',10001)
		})
	})
	it(`collapses directly preceding own hidden closed changeset along with combined open changeset`,()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetCloseBatchItem(1),usernames,true)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,true)
		gridBody.updateTableAccordingToSettings(false,false)
		gridBody.collapseItem({type:'changeset',id:10001})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithEach($row,
			$child=>{
				assertElementClassType($child,'changeset')
				assertChangesetClassTypes($child,['closed','hidden'])
				assertItemData($child,Date.parse('2023-03-01'),'changesetClose',10001)
			},$child=>{
				assertElementClassType($child,'changeset')
				assertChangesetClassTypes($child,['combined'])
				assertItemData($child,Date.parse('2023-03-01'),'changeset',10001)
			})
		)
	})
	it(`expands directly preceding own hidden closed changeset along with combined open changeset`,async()=>{
		const gridBody=makeSingleColumnGrid({
			getChangeset: async()=>makeChangesetItem(1)
		})
		gridBody.addItem(makeChangesetCloseBatchItem(1),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAccordingToSettings(false,false)
		await gridBody.expandItem({type:'changeset',id:10001})
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
	it(`doesn't collapse directly preceding other's closed changeset along with combined open changeset`,()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetCloseBatchItem(2),usernames,true)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,true)
		gridBody.updateTableAccordingToSettings(false,false)
		gridBody.collapseItem({type:'changeset',id:10001})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertChangesetClassTypes($row,['closed','hidden'])
			assertItemData($row,Date.parse('2023-03-02'),'changesetClose',10002)
		},$row=>assertRowIsCollectionWithEach($row,
			$child=>{
				assertElementClassType($child,'changeset')
				assertChangesetClassTypes($child,['combined'])
				assertItemData($child,Date.parse('2023-03-01'),'changeset',10001)
			})
		)
	})
	it("doesn't collapse visible closed changesets between collections",()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetBatchItem(3),usernames,true)
		gridBody.addItem(makeChangesetCloseBatchItem(2),usernames,true)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,true)
		gridBody.updateTableAccordingToSettings(false,true)
		gridBody.collapseItem({type:'changeset',id:10003})
		gridBody.collapseItem({type:'changeset',id:10001})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithEach($row,
			$child=>{
				assertElementClassType($child,'changeset')
				assertItemData($child,Date.parse('2023-03-03'),'changeset',10003)
			}
		),$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertItemData($row,Date.parse('2023-03-02'),'changesetClose',10002)
		},$row=>assertRowIsCollectionWithEach($row,
			$child=>{
				assertElementClassType($child,'changeset')
				assertItemData($child,Date.parse('2023-03-01'),'changeset',10001)
			})
		)
	})
	for (const [positionName,id1,id2] of [
		['top',10003,10001],
		['bottom',10001,10003],
	]) it(`collapses hidden closed changesets between collections when collapsing ${positionName} item first`,()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetBatchItem(3),usernames,true)
		gridBody.addItem(makeChangesetCloseBatchItem(2),usernames,true)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,true)
		gridBody.updateTableAccordingToSettings(false,false)
		gridBody.collapseItem({type:'changeset',id:id1})
		gridBody.collapseItem({type:'changeset',id:id2})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithEach($row,
			$child=>{
				assertElementClassType($child,'changeset')
				assertItemData($child,Date.parse('2023-03-03'),'changeset',10003)
			},$child=>{
				assertElementClassType($child,'changeset')
				assertItemData($child,Date.parse('2023-03-02'),'changesetClose',10002)
			},$child=>{
				assertElementClassType($child,'changeset')
				assertItemData($child,Date.parse('2023-03-01'),'changeset',10001)
			})
		)
	})
	it("expands all preceding hidden items when there are no visible items before",async()=>{
		const gridBody=makeSingleColumnGrid({
			getChangeset: async(id)=>{
				if (id==10001) return makeChangesetItem(1,'2023-03-01','2023-03-11')
				if (id==10002) return makeChangesetItem(2,'2023-03-02','2023-03-03')
				if (id==10003) return makeChangesetItem(3,'2023-03-04','2023-03-05')
			}
		})
		gridBody.addItem(makeChangesetCloseBatchItem(3,'2023-03-04','2023-03-05'),usernames,false)
		gridBody.addItem(makeChangesetCloseBatchItem(2,'2023-03-02','2023-03-03'),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(1,'2023-03-01','2023-03-11'),usernames,false)
		gridBody.updateTableAccordingToSettings(false,false)
		await gridBody.expandItem({type:'changeset',id:10001})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertChangesetClassTypes($row,['closed','hidden'])
			assertItemData($row,Date.parse('2023-03-05'),'changesetClose',10003)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertChangesetClassTypes($row,['closed','hidden'])
			assertItemData($row,Date.parse('2023-03-03'),'changesetClose',10002)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'changeset')
			assertChangesetClassTypes($row,['combined'])
			assertItemData($row,Date.parse('2023-03-01'),'changeset',10001)
		})
	})
	it("expands user item",async()=>{
		const gridBody=makeSingleColumnGrid({
			getUser: async()=>user1
		})
		gridBody.addItem({
			iColumns: [0],
			type: 'user',
			item: user1,
		},usernames,false)
		gridBody.updateTableAccordingToSettings(false,false)
		await gridBody.expandItem({type:'user',id:101})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,1)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'user')
			assertItemData($row,Date.parse('2023-01-01'),'user',101)
		})
	})
	for (const [actionName,isExpanded,actionMethod] of [
		[`expanding`,false,'expandItem'],
		[`collapsing`,true,'collapseItem'],
	]) it(`retains timeline when ${actionName} user item`,async()=>{
		const gridBody=makeSingleColumnGrid({
			getUser: async()=>user1
		})
		gridBody.addItem({
			iColumns: [0],
			type: 'user',
			item: user1,
		},usernames,isExpanded)
		gridBody.updateTableAccordingToSettings(false,false)
		await gridBody[actionMethod]({type:'user',id:101})
		const $cell=gridBody.$gridBody.rows[1].cells[0]
		assertElementClasses($cell,['with-timeline-above','with-timeline-below'],['with-timeline-above'],`Cell`)
	})
	it("expands second comment",async()=>{
		const gridBody=makeSingleColumnGrid({
			getChangesetComment: async(_,order)=>{
				if (order==0) return {comment:comment0,username:user2.name}
				if (order==1) return {comment:comment1,username:user1.name}
			}
		})
		gridBody.addItem({
			iColumns: [0],
			type: 'changesetComment',
			item: comment1,
		},usernames,false)
		gridBody.addItem({
			iColumns: [0],
			type: 'changesetComment',
			item: comment0,
		},usernames,false)
		gridBody.updateTableAccordingToSettings(false,false)
		await gridBody.expandItem({type:'changesetComment',id:10001,order:1})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,5)
		},$row=>{
			assertRowIsItem($row)
			assertElementClassType($row,'comment')
			assertItemData($row,Date.parse('2023-05-11'),'changesetComment',10001,1)
		},$row=>assertRowIsCollectionWithEach($row,
			$child=>{
				assertElementClassType($child,'comment')
				assertItemData($child,Date.parse('2023-05-10'),'changesetComment',10001)
			}
		))
	})
})

function assertElementClass($e,cls,isExpectedClass,name) {
	if (isExpectedClass) {
		assert($e.classList.contains(cls),`${name} doesn't contain expected class '${cls}'`)
	} else {
		assert(!$e.classList.contains(cls),`${name} contains unexpected class '${cls}'`)
	}
}
function assertElementClasses($e,allClasses,expectedClasses,name) {
	for (const cls of allClasses) {
		const isExpectedClass=expectedClasses.includes(cls)
		assertElementClass($e,cls,isExpectedClass,name)
	}
}
function assertElementClassType($e,classType) {
	assertElementClasses($e,[
		'changeset','note','comment','user'
	],[classType],`Element`)
}
function assertChangesetClassTypes($e,classTypes) {
	assertElementClasses($e,[
		'combined','closed','hidden'
	],classTypes,`Changeset`)
}

function assertRowIsCollectionWithEach($row,...fns) {
	assertRowIsCollection($row)
	assertEach($row.cells,$cell=>{
		assertEach($cell.children,$child=>{
			assertCellChildIsIcon($child)
		},...fns.map(fn=>$child=>{
			assertCellChildIsItem($child)
			fn($child)
		}))
	})
}

function assertRowIsSeparator($row) {
	assertElementClasses($row,[
		'separator','collection','item'
	],['separator'],`Row`)
}
function assertRowIsCollection($row) {
	assertElementClasses($row,[
		'separator','collection','item'
	],['collection'],`Row`)
}
function assertRowIsItem($row) {
	assertElementClasses($row,[
		'separator','collection','item'
	],['item'],`Row`)
	const $button=$row.querySelector('button.disclosure')
	assert($button,`No expected disclosure button`)
	const expandedState=$button.getAttribute('aria-expanded')
	assert.equal(expandedState,'true',`Expected 'true' as disclosure button expanded state, got '${expandedState}'`)
}

function assertCellChildIsIcon($e) {
	assert($e.classList.contains('icon'))
	assert(!$e.classList.contains('item'))
}
function assertCellChildIsItem($e) {
	assert(!$e.classList.contains('icon'))
	assert($e.classList.contains('item'))
	const $button=$e.querySelector('button.disclosure')
	assert($button,`No expected disclosure button`)
	const expandedState=$button.getAttribute('aria-expanded')
	assert.equal(expandedState,'false',`Expected 'false' as disclosure button expanded state, got '${expandedState}'`)
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
