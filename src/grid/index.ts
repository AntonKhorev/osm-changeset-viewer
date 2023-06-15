import GridHead from './head'
import GridBody from './body'
import type {Connection} from '../net'
import type {ChangesetViewerDBReader} from '../db'
import type More from '../more'
import type {ValidUserQuery} from '../osm'
import {makeElement} from '../util/html'

export default class Grid {
	$grid=makeElement('table')('grid')()
	addExpandedItems=false
	private $colgroup=makeElement('colgroup')()()
	private head: GridHead
	private body: GridBody
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
			db.getSingleItemReader()
		)
		this.head=new GridHead(
			cx,db,worker,
			columnUids=>this.setColumns(columnUids),
			(iShiftFrom,iShiftTo)=>this.body.reorderColumns(iShiftFrom,iShiftTo),
			()=>this.body.getColumnCheckboxStatuses(),
			(iColumn,isChecked)=>this.body.triggerColumnCheckboxes(iColumn,isChecked),
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
		this.body.onItemSelect=()=>this.head.updateSelectors()
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
	private setColumns(columnUids: (number|null)[]) {
		const nColumns=columnUids.length
		this.body.setColumns(columnUids)
		this.$grid.style.setProperty('--columns',String(nColumns))
		this.$colgroup.replaceChildren()
		this.$colgroup.append(
			makeElement('col')('all')()
		)
		for (let i=0;i<nColumns;i++) {
			this.$colgroup.append(
				makeElement('col')()()
			)
		}
		this.$colgroup.append(
			makeElement('col')('adder')()
		)
	}
	async receiveUpdatedUserQueries(userQueries: ValidUserQuery[]): Promise<void> {
		await this.head.receiveUpdatedUserQueries(userQueries)
	}
	async addUserQueries(userQueries: ValidUserQuery[]): Promise<void> {
		await this.head.addUserQueries(userQueries)
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
