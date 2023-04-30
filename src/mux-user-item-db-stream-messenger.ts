import type {WorkerBroadcastMessageOperationPart} from './broadcast-channel'
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
		private receiveBatch: (batch:GridBatchItem[])=>void
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
				action.batch.map((batchItem)=>({
					...batchItem,
					iColumns: this.uidToColumns.get(getMuxBatchItemUid(batchItem))??[]
				}))
			)
		} else if (action.type=='end') {
			this.receiveBatch([])
		}
	}
	async receiveMessage(messagePart: WorkerBroadcastMessageOperationPart): Promise<void> {
		if (messagePart.type=='scanUserItems') {
			if (messagePart.status=='ready' && this.watchedUids.has(messagePart.uid)) {
				this.watchedUids.delete(messagePart.uid)
				await this.requestNextBatch()
			}
		}
	}
}

function getMuxBatchItemUid(batchItem: MuxBatchItem): number {
	if (batchItem.type=='user') {
		return batchItem.item.id
	} if (batchItem.type=='changesetComment' || batchItem.type=='noteComment') {
		return batchItem.item.itemUid
	} else {
		return batchItem.item.uid
	}
}
