import {
	ValidUserQuery,
	OsmChangesetApiData, getChangesetsFromOsmApiResponse,
	OsmNoteApiData, getNotesFromOsmApiResponse
} from '../osm'
import StreamBoundary from '../stream-boundary'
import {toIsoString} from '../date'
import {makeEscapeTag} from '../util/escape'

const e=makeEscapeTag(encodeURIComponent)

const pastDateString=`20010101T000000Z`

abstract class UserItemStream<T> {
	boundary: StreamBoundary
	constructor(
		protected userQuery: ValidUserQuery,
		boundary?: StreamBoundary
	) {
		if (boundary) {
			this.boundary=boundary
		} else {
			this.boundary=new StreamBoundary()
		}
	}
	async fetch(fetcher: (path:string)=>Promise<Response>): Promise<T[]> {
		let previousTimestamp=this.boundary.timestamp
		let visitedNewItems: boolean
		do {
			visitedNewItems=false
			const path=this.getFetchPath(this.nextFetchUpperBoundDate)
			let response: Response
			try {
				response=await fetcher(path)
			} catch (ex) {
				throw new TypeError(`network error`)
			}
			if (!response.ok) {
				if (response.status==404) {
					throw new TypeError(`user not found / didn't agree to contributor terms`)
				} else {
					throw new TypeError(`unsuccessful response from OSM API`)
				}
			}
			const json=await response.json()
			const items=this.getOsmDataFromResponseJson(json)
			const newItems=[] as T[]
			for (const item of items) {
				const isItemAccepted=this.acceptItem(item)
				if (isItemAccepted) {
					this.modifyQueryInResponseToFetchedData(item)
				}
				const id=this.getItemId(item)
				const date=this.getItemDate(item)
				if (this.boundary.visit(date,id)) {
					visitedNewItems=true
					if (isItemAccepted) {
						newItems.push(item)
					}
				}
			}
			if (newItems.length>0) {
				return newItems
			}
			if (previousTimestamp==this.boundary.timestamp) {
				this.boundary.finish()
			}
		} while (visitedNewItems)
		return []
	}
	get nextFetchUpperBoundDate(): Date|null {
		return this.boundary.dateOneSecondBefore
	}
	protected get userParameter(): string {
		if (this.userQuery.type=='id') {
			return e`user=${this.userQuery.uid}`
		} else {
			return e`display_name=${this.userQuery.username}`
		}
	}
	protected abstract getFetchPath(upperBoundDate: Date|null): string
	protected abstract getOsmDataFromResponseJson(json: unknown): T[]
	protected modifyQueryInResponseToFetchedData(item: T): void {}
	protected acceptItem(item: T): boolean { return true }
	protected abstract getItemId(item: T): number
	protected abstract getItemDate(item: T): Date
}

export class UserChangesetStream extends UserItemStream<OsmChangesetApiData> {
	protected getFetchPath(upperBoundDate: Date|null): string {
		let timeParameter=''
		if (upperBoundDate) {
			timeParameter=e`&time=${pastDateString},${toIsoString(upperBoundDate,'','')}`
		}
		return `changesets.json?${this.userParameter}${timeParameter}`
	}
	protected getOsmDataFromResponseJson(json: unknown): OsmChangesetApiData[] {
		return getChangesetsFromOsmApiResponse(json)
	}
	protected modifyQueryInResponseToFetchedData(changeset: OsmChangesetApiData) {
		if (this.userQuery.type=='name') {
			this.userQuery={
				type: 'id',
				uid: changeset.uid
			}
		}
	}
	protected getItemId(changeset: OsmChangesetApiData): number {
		return changeset.id
	}
	protected getItemDate(changeset: OsmChangesetApiData): Date {
		return new Date(changeset.created_at)
	}
}

export class UserNoteStream extends UserItemStream<OsmNoteApiData> {
	protected getFetchPath(upperBoundDate: Date|null): string {
		let timeParameter=''
		if (upperBoundDate) {
			timeParameter=e`&from=${pastDateString}&to=${toIsoString(upperBoundDate,'','')}`
		}
		return `notes/search.json?${this.userParameter}&sort=created_at&closed=-1${timeParameter}`
	}
	protected getOsmDataFromResponseJson(json: unknown): OsmNoteApiData[] {
		return getNotesFromOsmApiResponse(json)
	}
	protected acceptItem(note: OsmNoteApiData): boolean {
		if (note.properties.comments.length==0) return false
		const [openingComment]=note.properties.comments
		if (openingComment.action!='opened') return false
		if (this.userQuery.type=='id') {
			return openingComment.uid==this.userQuery.uid
		} else {
			return openingComment.user==this.userQuery.username
		}
	}
	protected getItemId(note: OsmNoteApiData): number {
		return note.properties.id
	}
	protected getItemDate(note: OsmNoteApiData): Date {
		return parseNoteDate(note.properties.date_created)
	}
}

export function parseNoteDate(a: string): Date {
	const match=a.match(/^\d\d\d\d-\d\d-\d\d\s+\d\d:\d\d:\d\d/)
	if (!match) throw new RangeError(`invalid date format`)
	const [s]=match
	return new Date(s+'Z')
}
