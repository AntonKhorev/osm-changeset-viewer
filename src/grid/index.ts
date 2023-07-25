import GridHead from './head'
import type {ItemMapViewInfo} from './body'
import GridBody from './body'
import ItemOptions from './item-options'
import {writeHueAttributes} from './info'
import type Colorizer from '../colorizer'
import type {Connection} from '../net'
import type {ChangesetViewerDBReader} from '../db'
import type More from '../more'
import type {ValidUserQuery} from '../osm'
import {makeElement} from '../util/html'

export {ItemOptions, ItemMapViewInfo}

export {makeSvgOfBalloonRef} from './svg'

export default class Grid {
	$grid=makeElement('table')('grid')()
	addExpandedItems=false
	onExternalControlsStateUpdate: ()=>void = ()=>{}
	private $colgroup=makeElement('colgroup')()()
	private head: GridHead
	private body: GridBody
	constructor(
		$root: HTMLElement,
		colorizer: Colorizer,
		cx: Connection,
		db: ChangesetViewerDBReader,
		worker: SharedWorker,
		more: More,
		sendUpdatedUserQueriesReceiver: (
			userQueries: ValidUserQuery[]
		)=>void,
		resetMapViewReceiver: ()=>void,
		redrawMapViewReceiver: ()=>void,
		addItemToMapViewReceiver: (items: ItemMapViewInfo)=>void
	) {
		this.body=new GridBody(
			$root,colorizer,cx.server,
			db.getSingleItemReader(),
			resetMapViewReceiver,
			addItemToMapViewReceiver
		)
		this.head=new GridHead(
			colorizer,cx,db,worker,
			columnUids=>this.setColumns(columnUids),
			(iShiftFrom,iShiftTo)=>this.body.reorderColumns(iShiftFrom,iShiftTo),
			()=>this.body.getColumnCheckboxStatuses(),
			(iColumn,isChecked)=>this.body.triggerColumnCheckboxes(iColumn,isChecked),
			(uid)=>{
				for (const $e of this.$grid.querySelectorAll(`[data-hue-uid="${uid}"]`)) {
					if (!($e instanceof HTMLElement)) continue
					writeHueAttributes(colorizer,$e,uid)
				}
				redrawMapViewReceiver()
			},
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
					this.updateTableAfterOptionChanges()
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
	set withClosedChangesets(value: boolean) {
		this.body.withClosedChangesets=value
	}
	get withTotalColumn(): boolean {
		return this.body.withTotalColumn
	}
	get expandedItemOptions(): ItemOptions {
		return this.body.expandedItemOptions
	}
	get collapsedItemOptions(): ItemOptions {
		return this.body.collapsedItemOptions
	}
	private setColumns(columnUids: (number|undefined)[]) {
		this.body.setColumns(columnUids)
		this.$grid.classList.toggle('without-total-column',!this.withTotalColumn)
		this.$grid.style.setProperty('--columns',String(this.body.nColumns))
		this.$colgroup.replaceChildren()
		if (this.withTotalColumn) {
			this.$colgroup.append(
				makeElement('col')('all')()
			)
		}
		for (let i=0;i<this.body.nColumns;i++) {
			this.$colgroup.append(
				makeElement('col')()()
			)
		}
		this.$colgroup.append(
			makeElement('col')('all')()
		)
		this.onExternalControlsStateUpdate()
	}
	async receiveUpdatedUserQueries(userQueries: ValidUserQuery[]): Promise<void> {
		await this.head.receiveUpdatedUserQueries(userQueries)
	}
	async addUserQueries(userQueries: ValidUserQuery[]): Promise<void> {
		await this.head.addUserQueries(userQueries)
	}
	updateTableAfterOptionChanges(): void {
		this.body.updateTableAfterItemInsertsOrOptionChanges()
	}
	updateTableAfterExpandedItemOptionChanges(): void {
		this.body.updateTableAfterExpandedItemOptionChanges()
	}
	updateTableAfterCollapsedItemOptionChanges(): void {
		this.body.updateTableAfterCollapsedItemOptionChanges()
	}
	updateTableAfterAbbreviationOptionChanges(): void {
		this.body.updateTableAfterAbbreviationOptionChanges()
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
	stretchAllItems(): void {
		this.body.stretchAllItems()
	}
	shrinkAllItems(): void {
		this.body.shrinkAllItems()
	}
	listSelectedChangesetIds(): Iterable<number> {
		return this.body.listSelectedChangesetIds()
	}
}
