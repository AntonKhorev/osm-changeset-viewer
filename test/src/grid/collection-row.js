import {
	setupTestHooks,
	makeCollectionRow, makeCell, makeChangeset, makeChangesetPoint,
	assertChangesetCollectionRow
} from '../../grid.js'
import ItemCollectionRow from '../../../test-build/grid/collection-row.js'

const hue='--hue: 123;'

describe("ItemCollectionRow",()=>{
	setupTestHooks()
	it("splits single-cell collection",()=>{
		const $row=makeCollectionRow(makeCell('ab',hue,
			makeChangeset('2023-05-09',10103),
			makeChangeset('2023-05-07',10101)
		))
		const row=new ItemCollectionRow($row)
		const $splitRow=row.split(makeChangesetPoint('2023-05-08',10102)).$row
		assertChangesetCollectionRow($row,[
			[],['ab',hue,['2023-05-09',10103]]
		])
		assertChangesetCollectionRow($splitRow,[
			[],['ab',hue,['2023-05-07',10101]]
		])
	})
	it("splits single-cell collection with terminating timeline",()=>{
		const $row=makeCollectionRow(makeCell('a',hue,
			makeChangeset('2023-05-09',10103),
			makeChangeset('2023-05-07',10101)
		))
		const row=new ItemCollectionRow($row)
		const $splitRow=row.split(makeChangesetPoint('2023-05-08',10102)).$row
		assertChangesetCollectionRow($row,[
			[],['ab',hue,['2023-05-09',10103]]
		])
		assertChangesetCollectionRow($splitRow,[
			[],['a',hue,['2023-05-07',10101]]
		])
	})
	it("splits 2-cell collection",()=>{
		const $row=makeCollectionRow(
			makeCell('ab',hue,makeChangeset('2023-05-09',10103)),
			makeCell('ab',hue,makeChangeset('2023-05-07',10101))
		)
		const row=new ItemCollectionRow($row)
		const $splitRow=row.split(makeChangesetPoint('2023-05-08',10102)).$row
		assertChangesetCollectionRow($row,[
			[],
			['ab',hue,['2023-05-09',10103]],
			['ab',hue]
		])
		assertChangesetCollectionRow($splitRow,[
			[],
			['ab',hue],
			['ab',hue,['2023-05-07',10101]]
		])
	})
	it("splits collection with one filled and one blank cell without timeline",()=>{
		const $row=makeCollectionRow(
			makeCell('ab',hue,
				makeChangeset('2023-05-09',10103),
				makeChangeset('2023-05-07',10101)
			),makeCell('',hue)
		)
		const row=new ItemCollectionRow($row)
		const $splitRow=row.split(makeChangesetPoint('2023-05-08',10102)).$row
		assertChangesetCollectionRow($row,[
			[],
			['ab',hue,['2023-05-09',10103]],
			['  ',hue]
		])
		assertChangesetCollectionRow($splitRow,[
			[],
			['ab',hue,['2023-05-07',10101]],
			['  ',hue]
		])
	})
	it("splits 2-cell collection with timeline end and one blank cell after split",()=>{
		const $row=makeCollectionRow(
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
			[],
			['ab',hue,['2023-05-09',10103]],
			['a ',hue,['2023-05-10',10104]]
		])
		assertChangesetCollectionRow($splitRow,[
			[],
			['a ',hue,['2023-05-07',10101]],
			['  ',hue]
		])
	})
	it("merges with timeline-terminating row",()=>{
		const $row1=makeCollectionRow(makeCell('ab',hue,makeChangeset('2023-05-09',10103)))
		const $row2=makeCollectionRow(makeCell('a ',hue,makeChangeset('2023-05-08',10102)))
		const row1=new ItemCollectionRow($row1)
		const row2=new ItemCollectionRow($row2)
		row1.merge(row2)
		assertChangesetCollectionRow($row1,[
			[],['a',hue,['2023-05-09',10103],['2023-05-08',10102]],
		])
	})
	it("merges with empty cells in different columns",()=>{
		const $row1=makeCollectionRow(
			makeCell('ab',hue,makeChangeset('2023-05-09',10103)),
			makeCell('ab',hue)
		)
		const $row2=makeCollectionRow(
			makeCell('ab',hue),
			makeCell('ab',hue,makeChangeset('2023-05-08',10102))
		)
		const row1=new ItemCollectionRow($row1)
		const row2=new ItemCollectionRow($row2)
		row1.merge(row2)
		assertChangesetCollectionRow($row1,[
			[],
			['ab',hue,['2023-05-09',10103]],
			['ab',hue,['2023-05-08',10102]],
		])
	})
	it("inserts item at the beginning of one cell",()=>{
		const $row=makeCollectionRow(
			makeCell('a',hue,makeChangeset('2023-03-01',10001))
		)
		const row=new ItemCollectionRow($row)
		row.insert(makeChangesetPoint('2023-03-02',10002),[0],[makeChangeset('2023-03-02',10002)])
		assertChangesetCollectionRow($row,[
			[],['a',hue,['2023-03-02',10002],['2023-03-01',10001]]
		])
	})
	it("inserts item at the end of one cell in 2-cell row",()=>{
		const $row=makeCollectionRow(
			makeCell('ab',hue,makeChangeset('2023-05-09',10103)),
			makeCell('ab',hue,makeChangeset('2023-05-07',10101))
		)
		const row=new ItemCollectionRow($row)
		row.insert(makeChangesetPoint('2023-05-08',10102),[0],[makeChangeset('2023-05-08',10102)])
		assertChangesetCollectionRow($row,[
			[],
			['ab',hue,['2023-05-09',10103],['2023-05-08',10102]],
			['ab',hue,['2023-05-07',10101]]
		])
	})
	it("removes items from different 1-item cells",()=>{
		const $row=makeCollectionRow(
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
			[],
			['ab',hue,['2023-02-02',10202]],
			['ab',hue,['2023-02-02',10202]],
		])
	})
	it("stretches single item collection",()=>{
		const $row=makeCollectionRow(
			makeCell('a',hue,makeChangeset('2023-03-01',10001))
		)
		const row=new ItemCollectionRow($row)
		row.stretch()
		assertChangesetCollectionRow($row,[
			[,,['2023-03-01',10001]],
			['a',hue]
		])
	})
	it("inserts item into stretched row",()=>{
		const $row=makeCollectionRow(
			makeCell('a',hue,makeChangeset('2023-03-01',10001))
		)
		const row=new ItemCollectionRow($row)
		row.stretch()
		row.insert(makeChangesetPoint('2023-03-02',10002),[0],[makeChangeset('2023-03-02',10002)])
		assertChangesetCollectionRow($row,[
			[,,['2023-03-02',10002],['2023-03-01',10001]],
			['a',hue]
		])
	})
})
