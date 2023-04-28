export default class StreamBoundary {
	timestamp=+Infinity
	private visitedIds=new Set<number>()
	constructor(
		init?: {date: Date, visitedIds: Iterable<number>}
	) {
		if (init) {
			this.timestamp=init.date.getTime()
			this.visitedIds=new Set(init.visitedIds)
		}
	}
	visit(date: Date, id: number): boolean {
		const timestamp=date.getTime()
		if (timestamp>this.timestamp) {
			throw new RangeError(`attempt to move stream boundary up`)
		} else if (timestamp<this.timestamp) {
			this.visitedIds.clear()
		}
		this.timestamp=timestamp
		if (this.visitedIds.has(id)) {
			return false
		} else {
			this.visitedIds.add(id)
			return true
		}
	}
	finish(): void {
		this.timestamp=-Infinity
	}
	get date(): Date|null {
		if (this.timestamp<+Infinity) {
			return new Date(this.timestamp)
		} else {
			return null
		}
	}
	get dateOneSecondBefore(): Date|null {
		if (this.timestamp<+Infinity) {
			return new Date(this.timestamp+1000)
		} else {
			return null
		}
	}
}
