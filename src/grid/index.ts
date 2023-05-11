import GridHead from './head'
import GridBody from './body'
import type {Connection} from '../net'
import type {ChangesetViewerDBReader} from '../db'
import type {ValidUserQuery} from '../osm'
import {makeElement} from '../util/html'
import {moveInArray} from '../util/types'

export default class Grid {
	$grid=makeElement('table')('grid')()
	private $colgroup=makeElement('colgroup')()()
	private head: GridHead
	private body: GridBody
	private columnHues: (number|null)[] = []
	constructor(
		cx: Connection,
		db: ChangesetViewerDBReader,
		worker: SharedWorker,
		sendUpdatedUserQueriesReceiver: (
			userQueries: ValidUserQuery[]
		)=>void,
		restartStreamCallback: ()=>void,
		readyStreamCallback: (
			requestNextBatch: ()=>void
		) => void,
		readyForMoreStreamCallback: ()=>void,
		finishStreamCallback: ()=>void
	) {
		this.body=new GridBody()
		this.head=new GridHead(
			cx,db,worker,this.body,
			columnHues=>this.setColumns(columnHues),
			columnHues=>this.columnHues=columnHues, // TODO update existing table cells - currently not required because table is always cleared
			(iShiftFrom,iShiftTo)=>this.reorderColumns(iShiftFrom,iShiftTo),
			sendUpdatedUserQueriesReceiver,
			restartStreamCallback,
			readyStreamCallback,
			(batch,usernames)=>{
				let wroteAnyItem=false
				for (const batchItem of batch) {
					const wroteItem=this.body.makeAndAddItem(cx,this.columnHues,batchItem,usernames)
					wroteAnyItem||=wroteItem
				}
				if (wroteAnyItem) {
					this.updateTableAccordingToSettings()
					readyForMoreStreamCallback()
				} else {
					finishStreamCallback()
				}
			}
		)
		this.$grid.append(this.$colgroup,this.head.$gridHead,this.body.$gridBody)
		this.setColumns([])
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
		this.body.updateTableAccordingToSettings(
			this.$grid.classList.contains('in-one-column'),
			this.$grid.classList.contains('with-closed-changesets')
		)
	}
}
