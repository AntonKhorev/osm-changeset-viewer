import {strict as assert} from 'assert'
import {setupTestHooks} from '../../grid.js'
import GridBody from '../../../test-build/grid/body.js'

const colorizer={
	getHueForUid: ()=>180,
	setHueForUid: ()=>{}
}

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
		commentRefs: [],
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
	const gridBody=new GridBody(
		document,colorizer,server,itemReader,
		()=>{},()=>{},()=>{},()=>{},()=>{},()=>{}
	)
	gridBody.setColumns([101])
	return gridBody
}

describe("GridBody",()=>{
	setupTestHooks()
	it("creates empty table body",()=>{
		const gridBody=makeSingleColumnGrid()
		assert.equal(gridBody.$gridBody.rows.length,0)
	})
	it("adds 1 expanded item",()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetBatchItem(1),usernames,true)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
			}
		))
	})
	it("adds 1 collapsed item",()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithItems($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
			}
		))
	})
	it("adds 2 collapsed items",()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetBatchItem(2),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithItems($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-02'),'changeset',10002)
			},$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
			})
		)
	})
	it("adds 2 collapsed items in reverse order",()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(2),usernames,false)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithItems($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-02'),'changeset',10002)
			},$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
			})
		)
	})
	it("expands 1 item from collection of 1 item",async()=>{
		const gridBody=makeSingleColumnGrid({
			getChangeset: async()=>makeChangesetItem(1)
		})
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		await gridBody.expandItem({type:'changeset',id:10001})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
			}
		))
	})
	it("expands 1st item from collection of 2 items",async()=>{
		const gridBody=makeSingleColumnGrid({
			getChangeset: async()=>makeChangesetItem(2)
		})
		gridBody.addItem(makeChangesetBatchItem(2),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		await gridBody.expandItem({type:'changeset',id:10002})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-02'),'changeset',10002)
			}
		),$row=>assertRowIsCollectionWithItems($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
			}
		))
	})
	it("expands 2nd item from collection of 2 items",async()=>{
		const gridBody=makeSingleColumnGrid({
			getChangeset: async()=>makeChangesetItem(1)
		})
		gridBody.addItem(makeChangesetBatchItem(2),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		await gridBody.expandItem({type:'changeset',id:10001})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithItems($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-02'),'changeset',10002)
			}
		),$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
			}
		))
	})
	it("merges two collections when collapsing item between them",()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetBatchItem(3),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(2),usernames,true)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		gridBody.collapseItem({type:'changeset',id:10002})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithItems($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-03'),'changeset',10003)
			},$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-02'),'changeset',10002)
			},$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
			})
		)
	})
	for (const [withClosedChangesetsName,withClosedChangesetsValue] of [
		[`hide`,false],
		[`show`,true]
	]) it(`combines consecutive opened+closed changesets when asked to ${withClosedChangesetsName} closed`,()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.withClosedChangesets=withClosedChangesetsValue
		gridBody.addItem(makeChangesetCloseBatchItem(1),usernames,true)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,true)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['closed','hidden'])
				assertItemData($item,Date.parse('2023-03-01'),'changesetClose',10001)
			}
		),$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['combined'])
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
			}
		))
	})
	for (const [withClosedChangesetsName,withClosedChangesetsValue,combineName,openClasses,closedClasses] of [
		[`hide`,false,`combines`,['combined'],['closed','hidden']],
		[`show`,true,`doesn't combine`,[],['closed']]
	]) it(`${combineName} interleaving opened+closed changesets when asked to ${withClosedChangesetsName} closed`,()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.withClosedChangesets=withClosedChangesetsValue
		gridBody.addItem(makeChangesetCloseBatchItem(2,'2023-03-02','2023-03-04'),usernames,true)
		gridBody.addItem(makeChangesetCloseBatchItem(1,'2023-03-01','2023-03-03'),usernames,true)
		gridBody.addItem(makeChangesetBatchItem(2,'2023-03-02','2023-03-04'),usernames,true)
		gridBody.addItem(makeChangesetBatchItem(1,'2023-03-01','2023-03-03'),usernames,true)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,closedClasses)
				assertItemData($item,Date.parse('2023-03-04'),'changesetClose',10002)
			}
		),$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,closedClasses)
				assertItemData($item,Date.parse('2023-03-03'),'changesetClose',10001)
			}
		),$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,openClasses)
				assertItemData($item,Date.parse('2023-03-02'),'changeset',10002)
			}
		),$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,openClasses)
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
			}
		))
	})
	it(`collapses directly preceding own hidden closed changeset along with combined open changeset`,()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetCloseBatchItem(1),usernames,true)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,true)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		gridBody.collapseItem({type:'changeset',id:10001})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithItems($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['closed','hidden'])
				assertItemData($item,Date.parse('2023-03-01'),'changesetClose',10001)
			},$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['combined'])
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
			})
		)
	})
	it(`expands directly preceding own hidden closed changeset along with combined open changeset`,async()=>{
		const gridBody=makeSingleColumnGrid({
			getChangeset: async()=>makeChangesetItem(1)
		})
		gridBody.addItem(makeChangesetCloseBatchItem(1),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,false)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		await gridBody.expandItem({type:'changeset',id:10001})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['closed','hidden'])
				assertItemData($item,Date.parse('2023-03-01'),'changesetClose',10001)
			}
		),$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['combined'])
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
			}
		))
	})
	it(`doesn't collapse directly preceding other's closed changeset along with combined open changeset`,()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetCloseBatchItem(2),usernames,true)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,true)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		gridBody.collapseItem({type:'changeset',id:10001})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['closed','hidden'])
				assertItemData($item,Date.parse('2023-03-02'),'changesetClose',10002)
			}
		),$row=>assertRowIsCollectionWithItems($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['combined'])
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
			})
		)
	})
	it("doesn't collapse visible closed changesets between collections",()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.withClosedChangesets=true
		gridBody.addItem(makeChangesetBatchItem(3),usernames,true)
		gridBody.addItem(makeChangesetCloseBatchItem(2),usernames,true)
		gridBody.addItem(makeChangesetBatchItem(1),usernames,true)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		gridBody.collapseItem({type:'changeset',id:10003})
		gridBody.collapseItem({type:'changeset',id:10001})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithItems($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-03'),'changeset',10003)
			}
		),$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-02'),'changesetClose',10002)
			}
		),$row=>assertRowIsCollectionWithItems($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
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
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		gridBody.collapseItem({type:'changeset',id:id1})
		gridBody.collapseItem({type:'changeset',id:id2})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithItems($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-03'),'changeset',10003)
			},$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-02'),'changesetClose',10002)
			},$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
			})
		)
	})
	for (const [locationName,frontAction,backAction,frontRowAsserts,backRowAsserts,expandId] of [
		[`before`,()=>{},gridBody=>{
			gridBody.addItem(makeChangesetBatchItem(1,'2023-03-01','2023-03-11'),usernames,false)
		},[],[$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['combined'])
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
			}
		)],10001],
		[`after`,gridBody=>{
			gridBody.addItem(makeChangesetBatchItem(4,'2023-03-07','2023-03-08'),usernames,false)
		},()=>{},[$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['combined'])
				assertItemData($item,Date.parse('2023-03-07'),'changeset',10004)
			}
		)],[],10004],
	]) it(`expands all hidden items ${locationName} requested one when there are no visible items ${locationName} all of them`,async()=>{
		const gridBody=makeSingleColumnGrid({
			getChangeset: async(id)=>{
				if (id==10001) return makeChangesetItem(1,'2023-03-01','2023-03-11')
				if (id==10002) return makeChangesetItem(2,'2023-03-02','2023-03-03')
				if (id==10003) return makeChangesetItem(3,'2023-03-04','2023-03-05')
				if (id==10004) return makeChangesetItem(4,'2023-03-07','2023-03-08')
			}
		})
		frontAction(gridBody)
		gridBody.addItem(makeChangesetCloseBatchItem(3,'2023-03-04','2023-03-05'),usernames,false)
		gridBody.addItem(makeChangesetCloseBatchItem(2,'2023-03-02','2023-03-03'),usernames,false)
		backAction(gridBody)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		await gridBody.expandItem({type:'changeset',id:expandId})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},...frontRowAsserts,$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['closed','hidden'])
				assertItemData($item,Date.parse('2023-03-05'),'changesetClose',10003)
			}
		),$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['closed','hidden'])
				assertItemData($item,Date.parse('2023-03-03'),'changesetClose',10002)
			}
		),...backRowAsserts)
	})
	it("expands all hidden items after requested one (which is not first in its collection) when there are no visible items after all of them",async()=>{
		const gridBody=makeSingleColumnGrid({
			getChangeset: async(id)=>{
				if (id==10001) return makeChangesetItem(1,'2023-03-01','2023-03-01')
				if (id==10002) return makeChangesetItem(2,'2023-03-02','2023-03-03')
				if (id==10003) return makeChangesetItem(3,'2023-03-04','2023-03-05')
			}
		})
		gridBody.addItem(makeChangesetBatchItem(3,'2023-03-04','2023-03-05'),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(2,'2023-03-02','2023-03-03'),usernames,false)
		gridBody.addItem(makeChangesetCloseBatchItem(1,'2023-03-01','2023-03-01'),usernames,false)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		await gridBody.expandItem({type:'changeset',id:10002})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithItems($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['combined'])
				assertItemData($item,Date.parse('2023-03-04'),'changeset',10003)
			}
		),$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['combined'])
				assertItemData($item,Date.parse('2023-03-02'),'changeset',10002)
			}
		),$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['closed','hidden'])
				assertItemData($item,Date.parse('2023-03-01'),'changesetClose',10001)
			}
		))
	})
	it("doesn't expand any preceding hidden items when there's a visible item before",async()=>{
		const gridBody=makeSingleColumnGrid({
			getChangeset: async(id)=>{
				if (id==10001) return makeChangesetItem(1,'2023-03-01','2023-03-11')
				if (id==10002) return makeChangesetItem(2,'2023-03-02','2023-03-03')
				if (id==10003) return makeChangesetItem(3,'2023-03-04','2023-03-05')
			}
		})
		gridBody.addItem({
			iColumns: [0],
			type: 'note',
			item: {
				id: 1001,
				uid: 102,
				createdAt: new Date('2023-03-15'),
				openingComment: `meh`,
				commentRefs: [],
			},
		},usernames,false)
		gridBody.addItem(makeChangesetCloseBatchItem(3,'2023-03-04','2023-03-05'),usernames,false)
		gridBody.addItem(makeChangesetCloseBatchItem(2,'2023-03-02','2023-03-03'),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(1,'2023-03-01','2023-03-11'),usernames,false)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		await gridBody.expandItem({type:'changeset',id:10001})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsCollectionWithItems($row,
			$item=>{
				assertItemClass($item,'note')
				assertItemData($item,Date.parse('2023-03-15'),'note',1001)
			},$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['closed','hidden'])
				assertItemData($item,Date.parse('2023-03-05'),'changesetClose',10003)
			},$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['closed','hidden'])
				assertItemData($item,Date.parse('2023-03-03'),'changesetClose',10002)
			}
		),$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['combined'])
				assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
			}
		))
	})
	it("doesn't expand any following hidden items when there's a visible item after",async()=>{
		const gridBody=makeSingleColumnGrid({
			getChangeset: async(id)=>{
				if (id==10002) return makeChangesetItem(2,'2023-03-02','2023-03-03')
				if (id==10003) return makeChangesetItem(3,'2023-03-04','2023-03-05')
				if (id==10004) return makeChangesetItem(4,'2023-03-07','2023-03-08')
			}
		})
		gridBody.addItem(makeChangesetBatchItem(4,'2023-03-07','2023-03-08'),usernames,false)
		gridBody.addItem(makeChangesetCloseBatchItem(3,'2023-03-04','2023-03-05'),usernames,false)
		gridBody.addItem(makeChangesetCloseBatchItem(2,'2023-03-02','2023-03-03'),usernames,false)
		gridBody.addItem({
			iColumns: [0],
			type: 'note',
			item: {
				id: 1001,
				uid: 102,
				createdAt: new Date('2023-03-01'),
				openingComment: `meh`,
				commentRefs: [],
			},
		},usernames,false)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		await gridBody.expandItem({type:'changeset',id:10004})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['combined'])
				assertItemData($item,Date.parse('2023-03-07'),'changeset',10004)
			}
		),$row=>assertRowIsCollectionWithItems($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['closed','hidden'])
				assertItemData($item,Date.parse('2023-03-05'),'changesetClose',10003)
			},$item=>{
				assertItemClass($item,'changeset')
				assertChangesetSubclasses($item,['closed','hidden'])
				assertItemData($item,Date.parse('2023-03-03'),'changesetClose',10002)
			},$item=>{
				assertItemClass($item,'note')
				assertItemData($item,Date.parse('2023-03-01'),'note',1001)
			}
		))
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
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		await gridBody.expandItem({type:'user',id:101})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,1)
		},$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'user')
				assertItemData($item,Date.parse('2023-01-01'),'user',101)
			}
		))
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
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		await gridBody[actionMethod]({type:'user',id:101})
		const $cell=gridBody.$gridBody.rows[1].cells[1]
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
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		await gridBody.expandItem({type:'changesetComment',id:10001,order:1})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,5)
		},$row=>assertRowIsSingleWithItem($row,
			$item=>{
				assertItemClass($item,'comment')
				assertItemData($item,Date.parse('2023-05-11'),'changesetComment',10001,1)
			}
		),$row=>assertRowIsCollectionWithItems($row,
			$item=>{
				assertItemClass($item,'comment')
				assertItemData($item,Date.parse('2023-05-10'),'changesetComment',10001)
			}
		))
	})
	it("adds items to two-column collection",()=>{
		const gridBody=new GridBody(
			document,colorizer,server,null,
			()=>{},()=>{},()=>{},()=>{},()=>{},()=>{}
		)
		gridBody.setColumns([101,102])
		gridBody.addItem({
			iColumns: [0],
			type: 'changeset',
			item: makeChangesetItem(2),
		},usernames,false)
		gridBody.addItem({
			iColumns: [1],
			type: 'changeset',
			item: makeChangesetItem(1),
		},usernames,false)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>{
			assertRowIsCollection($row)
			assertEach($row.cells,()=>{},$cell=>{
				assertEach($cell.children,$container=>{
					assertEach($container.children,$item=>{
						assertCellChildIsIcon($item)
					},$item=>{
						assertCellChildIsCollapsedItem($item)
						assertItemData($item,Date.parse('2023-03-02'),'changeset',10002)
					})
				})
			},$cell=>{
				assertEach($cell.children,$container=>{
					assertEach($container.children,$item=>{
						assertCellChildIsIcon($item)
					},$item=>{
						assertCellChildIsCollapsedItem($item)
						assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
					})
				})
			})
		})
	})
	it("splits collection when items are in different columns",async()=>{
		const gridBody=new GridBody(
			document,colorizer,server,
			{
				getChangeset: async(id)=>{
					if (id==10001) return makeChangesetItem(1)
					if (id==10002) return makeChangesetItem(2)
					if (id==10003) return makeChangesetItem(3)
				}
			},
			()=>{},()=>{},()=>{},()=>{},()=>{},()=>{}
		)
		gridBody.setColumns([101,102])
		gridBody.addItem({
			iColumns: [0],
			type: 'changeset',
			item: makeChangesetItem(3),
		},usernames,false)
		gridBody.addItem({
			iColumns: [1],
			type: 'changeset',
			item: makeChangesetItem(2),
		},usernames,false)
		gridBody.addItem({
			iColumns: [1],
			type: 'changeset',
			item: makeChangesetItem(1),
		},usernames,false)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		await gridBody.expandItem({type:'changeset',id:10002})
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2023,3)
		},$row=>{
			assertRowIsCollection($row)
			assertEach($row.cells,()=>{},$cell=>{
				assertEach($cell.children,$container=>{
					assertEach($container.children,$item=>{
						assertCellChildIsIcon($item)
					},$item=>{
						assertCellChildIsCollapsedItem($item)
						assertItemData($item,Date.parse('2023-03-03'),'changeset',10003)
					})
				})
			},$cell=>{
				assertCellIsEmpty($cell)
			})
		},$row=>{
			assertRowIsSingle($row)
			assertEach($row.cells,()=>{},$cell=>{
				assertCellIsEmpty($cell)
			},$cell=>{
				assertEach($cell.children,$container=>{
					assertEach($container.children,$item=>{
						assertCellChildIsExpandedItem($item)
						assertItemData($item,Date.parse('2023-03-02'),'changeset',10002)
					})
				})
			})
		},$row=>{
			assertRowIsCollection($row)
			assertEach($row.cells,()=>{},$cell=>{
				assertCellIsEmpty($cell)
			},$cell=>{
				assertEach($cell.children,$container=>{
					assertEach($container.children,$item=>{
						assertCellChildIsIcon($item)
					},$item=>{
						assertCellChildIsCollapsedItem($item)
						assertItemData($item,Date.parse('2023-03-01'),'changeset',10001)
					})
				})
			})
		})
	})
	it("adds 2 collapsed items right before new year",()=>{
		const gridBody=makeSingleColumnGrid()
		gridBody.addItem(makeChangesetBatchItem(2,'2022-12-31T23:32:00Z','2022-12-31T23:32:10Z'),usernames,false)
		gridBody.addItem(makeChangesetBatchItem(1,'2022-12-31T23:31:00Z','2022-12-31T23:31:10Z'),usernames,false)
		gridBody.updateTableAfterItemInsertsOrOptionChanges()
		assertEach(gridBody.$gridBody.rows,$row=>{
			assertRowIsSeparator($row)
			assertSeparatorData($row,2022,12)
		},$row=>assertRowIsCollectionWithItems($row,
			$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2022-12-31T23:32:00Z'),'changeset',10002)
			},$item=>{
				assertItemClass($item,'changeset')
				assertItemData($item,Date.parse('2022-12-31T23:31:00Z'),'changeset',10001)
			})
		)
	})
})

// combined asserts for single-column grids
function assertRowIsCollectionWithItems($row,...fns) {
	assertRowIsCollection($row)
	assertEach($row.cells,()=>{},$cell=>{
		assertEach($cell.children,$container=>{
			assertEach($container.children,$item=>{
				assertCellChildIsIcon($item)
			},...fns.map(fn=>$item=>{
				assertCellChildIsCollapsedItem($item)
				fn($item)
			}))
		})
	})
}
function assertRowIsSingleWithItem($row,fn) {
	assertRowIsSingle($row)
	assertEach($row.cells,()=>{},$cell=>{
		assertEach($cell.children,$container=>{
			assertEach($container.children,$item=>{
				assertCellChildIsExpandedItem($item)
				fn($item)
			})
		})
	})
}

function assertItemClass($e,classType) {
	assertElementClasses($e,[
		'changeset','note','comment','user'
	],[classType],`Item`)
}
function assertChangesetSubclasses($e,subclassesWithHidden) {
	let expectHidden=false
	const subclasses=subclassesWithHidden.filter(v=>{
		if (v=='hidden') {
			expectHidden=true
			return false
		} else {
			return true
		}
	})
	assertElementClasses($e,[
		'combined','closed'
	],subclasses,`Changeset`)
	assert.equal($e.hidden,expectHidden,`Expected changeset to be ${expectHidden?`hidden`:`not hidden`}, but it ${$e.hidden?`was`:`wasn't`}`)
}

const rowClasses=['separator','collection','single']
function assertRowIsSeparator($row) {
	assertElementClasses($row,rowClasses,['separator'],`Row`)
}
function assertRowIsCollection($row) {
	assertElementClasses($row,rowClasses,['collection'],`Row`)
}
function assertRowIsSingle($row) {
	assertElementClasses($row,rowClasses,['single'],`Row`)
	const $button=$row.querySelector('button.disclosure')
	assert($button,`No expected disclosure button`)
	const expandedState=$button.getAttribute('aria-expanded')
	assert.equal(expandedState,'true',`Expected 'true' as disclosure button expanded state, got '${expandedState}'`)
}

function assertCellIsEmpty($cell) {
	assert($cell.children.length==0 || $cell.children.length==1)
	if ($cell.children.length==0) return
	assertEach($cell.children,$container=>{
		assertEach($container.children)
	})
}

function assertCellChildIsIcon($e) {
	assert($e.classList.contains('icon'))
	assert(!$e.classList.contains('item'))
}
function assertCellChildIsCollapsedItem($e) {
	assertCellChildIsItem($e,'false')
}
function assertCellChildIsExpandedItem($e) {
	assertCellChildIsItem($e,'true')
}
function assertCellChildIsItem($e,expectedExpandedState) {
	assert(!$e.classList.contains('icon'))
	assert($e.classList.contains('item'))
	const $button=$e.querySelector('button.disclosure')
	assert($button,`No expected disclosure button`)
	const expandedState=$button.getAttribute('aria-expanded')
	assert.equal(expandedState,expectedExpandedState,`Expected '${expectedExpandedState}' as disclosure button expanded state, got '${expandedState}'`)
}

function assertSeparatorData($separator,year,month) {
	assert.equal($separator.dataset.type,'separator')
	const timestamp=Number($separator.dataset.timestamp)
	assert(Number.isInteger(timestamp))
	const date=new Date(timestamp)
	const actualYear=date.getUTCFullYear()
	assert.equal(actualYear,year,`Expected separator year ${year}, got ${actualYear}`)
	const actualMonth=date.getUTCMonth()+1
	assert.equal(actualMonth,month,`Expected separator month ${month}, got ${actualMonth}`)
}
function assertItemData($item,timestamp,type,id,order) {
	assert.equal($item.dataset.id,String(id))
	assert.equal($item.dataset.type,type)
	assert.equal($item.dataset.timestamp,String(timestamp))
	if (order!=null) {
		assert.equal($item.dataset.order,String(order))
	} else {
		assert.equal($item.dataset.order,undefined)
	}
}

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

function assertEach(xs,...fns) {
	assert.equal(xs.length,fns.length,`Expected sequence to have ${fns.length} element(s), got ${xs.length} instead`)
	for (const [i,fn] of fns.entries()) {
		fn(xs[i])
	}
}
