import {
	ValidUserQuery,
	OsmChangesetApiData, getChangesetsFromOsmApiResponse, getChangesetFromOsmApiResponse,
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
		const path=this.getFetchPath(this.nextFetchUpperBoundDate)
		const json=await this.fetchJson(fetcher,path)
		const items=this.getOsmDataFromResponseJson(json)
		const newItems=[] as T[]
		let fetchedNewItems=false
		for (let item of items) {
			const id=this.getItemId(item)
			const date=this.getItemDate(item)
			if (!this.boundary.visit(date,id)) continue
			fetchedNewItems=true
			if (!this.acceptItem(item)) continue
			const additionalPath=this.getFullFetchPathIfRequired(item)
			if (additionalPath) {
				const json=await this.fetchJson(fetcher,additionalPath)
				item=this.getFullOsmDataFromResponseJson(json)
			}
			this.modifyQueryInResponseToFetchedData(item)
			newItems.push(item)
		}
		if (!fetchedNewItems) {
			this.boundary.finish()
		}
		return newItems
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
	protected getFullFetchPathIfRequired(item: T): string|null { return null }
	protected abstract getOsmDataFromResponseJson(json: unknown): T[]
	protected getFullOsmDataFromResponseJson(json: unknown): T { throw new TypeError(`unexpected request for full osm item data`) }
	protected modifyQueryInResponseToFetchedData(item: T): void {}
	protected acceptItem(item: T): boolean { return true }
	protected abstract getItemId(item: T): number
	protected abstract getItemDate(item: T): Date
	private async fetchJson(
		fetcher: (path:string)=>Promise<Response>,
		path: string
	): Promise<unknown> {
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
		return await response.json()
	}
}

export class UserChangesetStream extends UserItemStream<OsmChangesetApiData> {
	protected getFetchPath(upperBoundDate: Date|null): string {
		let timeParameter=''
		if (upperBoundDate) {
			timeParameter=e`&time=${pastDateString},${toIsoString(upperBoundDate,'','')}`
		}
		return `changesets.json?${this.userParameter}${timeParameter}`
	}
	protected getFullFetchPathIfRequired(changeset: OsmChangesetApiData): string|null {
		if (changeset.comments_count<=0) return null
		return e`changeset/${changeset.id}.json?include_discussion=true`
	}
	protected getOsmDataFromResponseJson(json: unknown): OsmChangesetApiData[] {
		return getChangesetsFromOsmApiResponse(json)
	}
	protected getFullOsmDataFromResponseJson(json: unknown): OsmChangesetApiData {
		return getChangesetFromOsmApiResponse(json)
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
