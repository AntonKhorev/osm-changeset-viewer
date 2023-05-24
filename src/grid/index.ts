import GridHead from './head'
import GridBody from './body'
import type {Connection} from '../net'
import type {ChangesetViewerDBReader} from '../db'
import type More from '../more'
import type {ValidUserQuery} from '../osm'
import {makeElement} from '../util/html'
import {moveInArray} from '../util/types'

export default class Grid {
	$grid=makeElement('table')('grid')()
	addExpandedItems=false
	private $colgroup=makeElement('colgroup')()()
	private head: GridHead
	private body: GridBody
	private columnHues: (number|null)[] = []
	constructor(
		cx: Connection,
		db: ChangesetViewerDBReader,
		worker: SharedWorker,
		more: More,
		sendUpdatedUserQueriesReceiver: (
			userQueries: ValidUserQuery[]
		)=>void
	) {
		this.body=new GridBody(
			cx.server,
			db.getSingleItemReader(),
			()=>this.columnHues
		)
		this.head=new GridHead(
			cx,db,worker,this.body,
			columnHues=>this.setColumns(columnHues),
			columnHues=>this.columnHues=columnHues, // TODO update existing table cells - currently not required because table is always cleared
			(iShiftFrom,iShiftTo)=>this.reorderColumns(iShiftFrom,iShiftTo),
			sendUpdatedUserQueriesReceiver,
			()=>{
				more.changeToNothingToLoad()
				more.$button.onclick=null
			},(requestNextBatch)=>{
				more.changeToLoad()
				more.$button.onclick=()=>{
					more.changeToLoading()
					requestNextBatch()
				}
			},(batch,usernames)=>{
				let wroteAnyItem=false
				for (const batchItem of batch) {
					const wroteItem=this.body.addItem(batchItem,usernames,this.addExpandedItems)
					wroteAnyItem||=wroteItem
				}
				if (wroteAnyItem) {
					this.updateTableAccordingToSettings()
					more.changeToLoadMore()
				} else {
					more.changeToLoadedAll()
					more.$button.onclick=null
				}
			}
		)
		this.$grid.append(this.$colgroup,this.head.$gridHead,this.body.$gridBody)
		this.setColumns([])
	}
	set withCompactIds(value: boolean) {
		this.body.withCompactIds=value
	}
	set withClosedChangesets(value: boolean) {
		this.body.withClosedChangesets=value
	}
	set inOneColumn(value: boolean) {
		this.body.inOneColumn=value
	}
	get nColumns(): number {
		return this.columnHues.length
	}
	private setColumns(columnHues: (number|null)[]) {
		this.columnHues=columnHues
		this.body.setColumns(columnHues.length)
		this.$grid.style.setProperty('--columns',String(this.nColumns))
		this.$colgroup.replaceChildren()
		for (let i=0;i<this.nColumns;i++) {
			this.$colgroup.append(
				makeElement('col')()()
			)
		}
		this.$colgroup.append(
			makeElement('col')('adder')()
		)
	}
	private reorderColumns(iShiftFrom: number, iShiftTo: number): void {
		moveInArray(this.columnHues,iShiftFrom,iShiftTo)
		this.body.reorderColumns(iShiftFrom,iShiftTo)
	}
	async receiveUpdatedUserQueries(userQueries: ValidUserQuery[]): Promise<void> {
		await this.head.receiveUpdatedUserQueries(userQueries)
	}
	updateTableAccordingToSettings(): void {
		this.body.updateTableAccordingToSettings()
	}
	async expandSelectedItems(): Promise<void> {
		for (const id of this.body.listSelectedChangesetIds()) {
			await this.body.expandItem({type:'changeset',id})
		}
	}
	collapseSelectedItems(): void {
		for (const id of this.body.listSelectedChangesetIds()) {
			this.body.collapseItem({type:'changeset',id})
		}
	}
	listSelectedChangesetIds(): Iterable<number> {
		return this.body.listSelectedChangesetIds()
	}
}
