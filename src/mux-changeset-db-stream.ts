import type {ChangesetViewerDBReader, ChangesetDbRecord, UserChangesetScanDbRecord} from './db'

// { https://stackoverflow.com/a/42919752

type HeapItem = [timestamp: number, uid: number, changeset: ChangesetDbRecord]

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
		const [timestamp1,,changeset1]=this.heap[i]
		const [timestamp2,,changeset2]=this.heap[j]
		if (timestamp1!=timestamp2) return timestamp1>timestamp2
		return changeset1.id>changeset2.id
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
	scan: UserChangesetScanDbRecord|null
	visitedChangesetIds: Set<number>
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
		batch: [uid: number, changeset: ChangesetDbRecord][]
	} | {
		type: 'startScan'|'continueScan'
		uid: number
	} | {
		type: 'end'
	}> {
		for (const muxEntry of this.muxEntries) {
			if (!muxEntry.scan) {
				const scan=await this.db.getCurrentUserChangesetScan(muxEntry.uid)
				if (!scan) return {
					type: 'startScan',
					uid: muxEntry.uid
				}
				muxEntry.scan=scan
			}
			if (muxEntry.lowestReachedTimestamp<+Infinity) continue
			if (await this.enqueueMoreChangesetsAndCheckIfNeedToContinueScan(muxEntry)) {
				return {
					type: 'continueScan',
					uid: muxEntry.uid
				}
			}
		}
		const batch=[] as [uid: number, changeset: ChangesetDbRecord][]
		const moveQueueTopToResults=()=>{
			const [,uid,changeset]=this.queue.pop()
			batch.push([uid,changeset])
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
						type: 'continueScan',
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
			const scanUpperTimestamp=muxEntry.scan.upperChangesetDate.getTime()
			const upperDate=(muxEntry.lowestReachedTimestamp<scanUpperTimestamp
				? new Date(muxEntry.lowestReachedTimestamp)
				: muxEntry.scan.upperChangesetDate
			)
			const lowerDate=muxEntry.scan.lowerChangesetDate
			let newLowestReachedTimestamp=-Infinity
			const changesets=await this.db.getChangesets(muxEntry.uid,100,upperDate,lowerDate)
			for (const changeset of changesets) {
				if (muxEntry.visitedChangesetIds.has(changeset.id)) continue
				muxEntry.visitedChangesetIds.add(changeset.id)
				newLowestReachedTimestamp=changeset.createdAt.getTime()
				this.queue.push([newLowestReachedTimestamp,muxEntry.uid,changeset])
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
