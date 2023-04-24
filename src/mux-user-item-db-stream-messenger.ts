import type {WorkerBroadcastChannelMessage} from './broadcast-channel'
import type MuxUserItemDbStream from './mux-user-item-db-stream'
import type {MuxBatchItem} from './mux-user-item-db-stream'
import {moveInArray} from './util/types'

export type GridBatchItem = {
	iColumns: number[]
} & MuxBatchItem

export default class MuxUserItemDbStreamMessenger {
	private uidToColumns=new Map<number,number[]>()
	private watchedUids=new Set<number>()
	constructor(
		private host: string,
		private worker: SharedWorker,
		private stream: MuxUserItemDbStream,
		private columnUids: (number|null)[],
		private receiveBatch: (batch:Iterable<GridBatchItem>)=>void
	) {
		this.updateUidToColumns()
	}
	private updateUidToColumns(): void {
		this.uidToColumns.clear()
		for (const [iColumn,uid] of this.columnUids.entries()) {
			if (uid==null) continue
			if (!this.uidToColumns.has(uid)) {
				this.uidToColumns.set(uid,[])
			}
			this.uidToColumns.get(uid)?.push(iColumn)
		}
	}
	reorderColumns(iShiftFrom: number, iShiftTo: number): void {
		moveInArray(this.columnUids,iShiftFrom,iShiftTo)
		this.updateUidToColumns()
	}
	async requestNextBatch(): Promise<void> {
		const action=await this.stream.getNextAction()
		if (action.type=='scan') {
			this.watchedUids.add(action.uid)
			this.worker.port.postMessage({
				type: 'scanUserItems',
				host: this.host,
				start: action.start,
				itemType: action.itemType,
				uid: action.uid,
			})
		} else if (action.type=='batch') {
			this.receiveBatch(
				action.batch.map((batchItem)=>({...batchItem,iColumns:this.uidToColumns.get(batchItem.item.uid)??[]}))
			)
		} else if (action.type=='end') {
			this.receiveBatch([])
		}
	}
	async receiveMessage(message: WorkerBroadcastChannelMessage): Promise<void> {
		if (message.type=='scanUserItems') {
			if (message.status=='ready' && this.watchedUids.has(message.uid)) {
				this.watchedUids.delete(message.uid)
				await this.requestNextBatch()
			}
		}
	}
}
