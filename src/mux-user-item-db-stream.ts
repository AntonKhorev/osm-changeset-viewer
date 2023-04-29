import StreamBoundary from './stream-boundary'
import type {ChangesetViewerDBReader, UserDbRecord, ChangesetDbRecord, NoteDbRecord, UserScanDbRecord} from './db'

// { https://stackoverflow.com/a/42919752

const USER = 0
const CHANGESET = 1
const CHANGESET_CLOSE = 2
const NOTE = 3
type VisibleUserDbRecord = Extract<UserDbRecord,{visible:true}>
type HeapItem =
	[timestamp: number, type: typeof USER, user: VisibleUserDbRecord] |
	[timestamp: number, type: typeof CHANGESET | typeof CHANGESET_CLOSE, changeset: ChangesetDbRecord] |
	[timestamp: number, type: typeof NOTE, note: NoteDbRecord]

const iTop=0
const iParent = (i:number)=>((i+1)>>>1)-1
const iLeft   = (i:number)=>(i<<1)+1
const iRight  = (i:number)=>(i+1)<<1

class MuxUserItemPriorityQueue {
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
		const [timestamp1,type1,item1]=this.heap[i]
		const [timestamp2,type2,item2]=this.heap[j]
		if (timestamp1!=timestamp2) return timestamp1>timestamp2
		if (type1!=type2) return type1>type2
		return item1.id>item2.id
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
	itemType: 'changesets'|'notes'
	uid: number
	scan: UserScanDbRecord|null
	boundary: StreamBoundary
}

export type MuxBatchItem = {
	type: 'user'
	item: VisibleUserDbRecord
} | {
	type: 'changeset'|'changesetClose'
	item: ChangesetDbRecord
} | {
	type: 'note'
	item: NoteDbRecord
}

export default class MuxUserItemDbStream {
	private muxEntries: MuxEntry[]
	private queue = new MuxUserItemPriorityQueue()
	constructor(
		private db: ChangesetViewerDBReader,
		users: UserDbRecord[]
	) {
		const itemTypes: MuxEntry['itemType'][] = ['changesets','notes']
		this.muxEntries=users.flatMap(({id})=>(itemTypes.map(itemType=>({
			itemType,
			uid: id,
			scan: null,
			boundary: new StreamBoundary(),
		}))))
		for (const user of users) {
			if (!user.visible) continue
			this.queue.push([user.createdAt.getTime(),USER,user])
		}
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
			const {itemType,uid}=muxEntry
			if (!muxEntry.scan) {
				const scan=await this.db.getCurrentUserScan(itemType,uid)
				if (!scan) {
					return {
						type: 'scan',
						start: true,
						itemType,uid
					}
				}
				muxEntry.scan=scan
			}
			if (muxEntry.boundary.isStarted) continue
			const continueScan=await this.enqueueMoreItemsAndCheckIfNeedToContinueScan(muxEntry)
			if (continueScan) {
				return {
					type: 'scan',
					start: false,
					itemType,uid
				}
			}
		}
		const batch=[] as MuxBatchItem[]
		const moveQueueTopToResults=()=>{
			const [,type,item]=this.queue.pop()
			if (type==USER) {
				batch.push({type:'user',item})
			} else if (type==CHANGESET) {
				batch.push({type:'changeset',item})
			} else if (type==CHANGESET_CLOSE) {
				batch.push({type:'changesetClose',item})
			} else if (type==NOTE) {
				batch.push({type:'note',item})
			}
		}
		let loopLimit=100
		while (loopLimit-->0) {
			let upperTimestamp=-Infinity
			let upperMuxEntry: MuxEntry|undefined
			for (const muxEntry of this.muxEntries) {
				if (upperTimestamp>=muxEntry.boundary.timestamp) continue
				upperTimestamp=muxEntry.boundary.timestamp
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
				const {itemType,uid}=upperMuxEntry
				if (await this.enqueueMoreItemsAndCheckIfNeedToContinueScan(upperMuxEntry)) {
					return {
						type: 'scan',
						start: false,
						itemType,uid
					}
				}
			} else {
				break
			}
		}
		if (loopLimit<=0) {
			throw new RangeError(`too many iterations in mux stream db/queue read loop`)
		}
		return {type:'end'}
	}
	private async enqueueMoreItemsAndCheckIfNeedToContinueScan(muxEntry: MuxEntry): Promise<boolean> {
		if (!muxEntry.scan) throw new RangeError(`no expected user item scan`)
		let oldBoundaryTimestamp=muxEntry.boundary.timestamp
		let isEmptyDbGet=true
		if (muxEntry.itemType=='changesets') {
			const changesets=await this.db.getUserItems(muxEntry.itemType,muxEntry.uid,muxEntry.scan,muxEntry.boundary,100)
			for (const changeset of changesets) {
				isEmptyDbGet=false
				if (changeset.closedAt) {
					this.queue.push([changeset.closedAt.getTime(),CHANGESET_CLOSE,changeset])
				}
				this.queue.push([changeset.createdAt.getTime(),CHANGESET,changeset])
			}
		} else if (muxEntry.itemType=='notes') {
			const notes=await this.db.getUserItems(muxEntry.itemType,muxEntry.uid,muxEntry.scan,muxEntry.boundary,100)
			for (const note of notes) {
				isEmptyDbGet=false
				this.queue.push([note.createdAt.getTime(),NOTE,note])
			}
		}
		if (isEmptyDbGet && muxEntry.boundary.timestamp>=oldBoundaryTimestamp && !muxEntry.scan.endDate) {
			muxEntry.scan=null
			return true
		}
		return false
	}
}
