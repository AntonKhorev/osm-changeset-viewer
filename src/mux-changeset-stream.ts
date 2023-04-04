import type {OsmChangesetApiData} from './osm'

// { https://stackoverflow.com/a/42919752

type HeapItem = [timestamp: number, nStream: number, changeset: OsmChangesetApiData]

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
		return changeset1>changeset2
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

interface AnyChangesetStream {
	fetch(): Promise<OsmChangesetApiData[]>
}

type MuxEntry = {
	stream: AnyChangesetStream
	lowestTimestamp: number // +Infinity before stream began, -Infinity when stream ended
}

export default class MuxChangesetStream {
	private muxEntries: MuxEntry[]
	private queue = new MuxChangesetPriorityQueue()
	constructor(streams: AnyChangesetStream[]){
		this.muxEntries=streams.map(stream=>({
			stream,
			lowestTimestamp: +Infinity,
		}))
	}
	async fetch(): Promise<[nStream:number,changeset:OsmChangesetApiData][]> {
		if (this.muxEntries.length==0) return []
		const results=[] as [nStream:number,changeset:OsmChangesetApiData][]
		const moveQueueTopToResults=()=>{
			const [,nStream,changeset]=this.queue.pop()
			results.push([nStream,changeset])
		}
		do {
			let upperTimestamp=-Infinity
			let nUpperStream: number|undefined
			for (const [n,muxEntry] of this.muxEntries.entries()) {
				if (muxEntry.lowestTimestamp==+Infinity) {
					await this.fetchMuxEntry(n)
				}
				if (upperTimestamp>=muxEntry.lowestTimestamp) continue
				upperTimestamp=muxEntry.lowestTimestamp
				nUpperStream=n
			}
			if (nUpperStream==null) {
				while (!this.queue.isEmpty) {
					moveQueueTopToResults()
				}
				break
			}
			await this.fetchMuxEntry(nUpperStream)
			while (!this.queue.isEmpty) {
				const [timestamp]=this.queue.peek()
				if (timestamp<upperTimestamp) break
				moveQueueTopToResults()
			}
		} while (results.length==0)
		return results
	}
	private async fetchMuxEntry(nStream: number): Promise<void> {
		const muxEntry=this.muxEntries[nStream]
		const newChangesets=await muxEntry.stream.fetch()
		if (newChangesets.length==0) {
			muxEntry.lowestTimestamp=-Infinity
			return
		}
		for (const changeset of newChangesets) {
			const timestamp=Date.parse(changeset.created_at)
			muxEntry.lowestTimestamp=timestamp
			this.queue.push([timestamp,nStream,changeset])
		}
	}
}
