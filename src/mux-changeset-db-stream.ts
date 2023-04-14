import type {ChangesetViewerDBReader, ChangesetDbRecord, UserScanDbRecord} from './db'

// { https://stackoverflow.com/a/42919752

type HeapItem = [timestamp: number, uid: number, changeset: ChangesetDbRecord, close: number]

const iTop=0
const iParent = (i:number)=>((i+1)>>>1)-1
const iLeft   = (i:number)=>(i<<1)+1
const iRight  = (i:number)=>(i+1)<<1

class MuxChangesetPriorityQueue {
	private heap: HeapItem[] = []
	get size() {
		return this.heap.length
	}
	get isEmpty() {
		return this.size==0
	}
	peek() {
		return this.heap[iTop]
	}
	push(value: HeapItem) {
		this.heap.push(value)
		this.siftUp()
	}
	pop() {
		const poppedValue=this.peek()
		const bottom=this.size-1
		if (bottom>iTop) {
			this.swap(iTop,bottom)
		}
		this.heap.pop()
		this.siftDown()
		return poppedValue
	}
	private greater(i: number, j: number) {
		const [timestamp1,,changeset1,close1]=this.heap[i]
		const [timestamp2,,changeset2,close2]=this.heap[j]
		if (timestamp1!=timestamp2) return timestamp1>timestamp2
		if (changeset1.id!=changeset2.id) return changeset1.id>changeset2.id
		return close1>close2
	}
	private swap(i: number, j: number) {
		[this.heap[i],this.heap[j]]=[this.heap[j],this.heap[i]]
	}
	private siftUp() {
		let node=this.size-1
		while (node>iTop && this.greater(node,iParent(node))) {
			this.swap(node,iParent(node))
			node=iParent(node)
		}
	}
	private siftDown() {
		let node=iTop
		while (
			(iLeft (node)<this.size && this.greater(iLeft (node),node)) ||
			(iRight(node)<this.size && this.greater(iRight(node),node))
		) {
			let maxChild=(iRight(node)<this.size && this.greater(iRight(node),iLeft(node))) ? iRight(node) : iLeft(node)
			this.swap(node,maxChild)
			node=maxChild
		}
	}
}

// } https://stackoverflow.com/a/42919752

type MuxEntry = {
	uid: number
	lowestReachedTimestamp: number // +Infinity before stream began, -Infinity when stream ended
	scan: UserScanDbRecord|null
	visitedChangesetIds: Set<number>
}

export type MuxBatchItem = {
	uid: number,
	type: 'open'|'close',
	changeset: ChangesetDbRecord
}

export default class MuxChangesetDbStream {
	private muxEntries: MuxEntry[]
	private queue = new MuxChangesetPriorityQueue()
	constructor(
		private db: ChangesetViewerDBReader,
		uids: number[]
	) {
		this.muxEntries=uids.map(uid=>({
			uid,
			lowestReachedTimestamp: +Infinity,
			scan: null,
			visitedChangesetIds: new Set()
		}))
	}
	async getNextAction(): Promise<{
		type: 'batch'
		batch: MuxBatchItem[]
	} | {
		type: 'scan'
		start: boolean
		itemType: 'changesets'|'notes'
		uid: number
	} | {
		type: 'end'
	}> {
		for (const muxEntry of this.muxEntries) {
			if (!muxEntry.scan) {
				const scan=await this.db.getCurrentUserScan('changesets',muxEntry.uid)
				if (!scan) return {
					type: 'scan',
					start: true,
					itemType: 'changesets',
					uid: muxEntry.uid
				}
				muxEntry.scan=scan
			}
			if (muxEntry.lowestReachedTimestamp<+Infinity) continue
			if (await this.enqueueMoreChangesetsAndCheckIfNeedToContinueScan(muxEntry)) {
				return {
					type: 'scan',
					start: false,
					itemType: 'changesets',
					uid: muxEntry.uid
				}
			}
		}
		const batch=[] as MuxBatchItem[]
		const moveQueueTopToResults=()=>{
			const [,uid,changeset,closed]=this.queue.pop()
			batch.push({
				uid,changeset,
				type: closed?'close':'open'
			})
		}
		while (true) {
			let upperTimestamp=-Infinity
			let upperMuxEntry: MuxEntry|undefined
			for (const muxEntry of this.muxEntries) {
				if (upperTimestamp>=muxEntry.lowestReachedTimestamp) continue
				upperTimestamp=muxEntry.lowestReachedTimestamp
				upperMuxEntry=muxEntry
			}
			while (!this.queue.isEmpty) {
				const [timestamp]=this.queue.peek()
				if (timestamp<upperTimestamp) break
				moveQueueTopToResults()
			}
			if (batch.length>0) {
				return {
					type: 'batch',
					batch
				}
			}
			if (upperMuxEntry) {
				if (await this.enqueueMoreChangesetsAndCheckIfNeedToContinueScan(upperMuxEntry)) {
					return {
						type: 'scan',
						start: false,
						itemType: 'changesets',
						uid: upperMuxEntry.uid
					}
				}
			} else {
				break
			}
		}
		return {type:'end'}
	}
	private async enqueueMoreChangesetsAndCheckIfNeedToContinueScan(muxEntry: MuxEntry): Promise<boolean> {
		if (!muxEntry.scan) throw new RangeError(`no expected changeset scan`)
		if (muxEntry.scan.empty) {
			if (!muxEntry.scan.endDate) {
				muxEntry.scan=null
				return true
			}
			muxEntry.lowestReachedTimestamp=-Infinity
		} else {
			const scanUpperTimestamp=muxEntry.scan.upperItemDate.getTime()
			const upperDate=(muxEntry.lowestReachedTimestamp<scanUpperTimestamp
				? new Date(muxEntry.lowestReachedTimestamp)
				: muxEntry.scan.upperItemDate
			)
			const lowerDate=muxEntry.scan.lowerItemDate
			let newLowestReachedTimestamp=-Infinity
			const changesets=await this.db.getUserItems('changesets',muxEntry.uid,100,upperDate,lowerDate)
			for (const changeset of changesets) {
				if (muxEntry.visitedChangesetIds.has(changeset.id)) continue
				muxEntry.visitedChangesetIds.add(changeset.id)
				if (changeset.closedAt) {
					this.queue.push([changeset.closedAt.getTime(),muxEntry.uid,changeset,1])
				}
				newLowestReachedTimestamp=changeset.createdAt.getTime()
				this.queue.push([newLowestReachedTimestamp,muxEntry.uid,changeset,0])
			}
			if (newLowestReachedTimestamp==-Infinity && !muxEntry.scan.endDate) {
				muxEntry.scan=null
				return true
			}
			muxEntry.lowestReachedTimestamp=newLowestReachedTimestamp
		}
		return false
	}
}
