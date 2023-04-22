import {ApiProvider} from '../net'
import {
	ValidUserQuery,
	OsmChangesetApiData, getChangesetsFromOsmApiResponse,
	OsmNoteApiData, getNotesFromOsmApiResponse
} from '../osm'
import {toIsoString} from '../date'
import {makeEscapeTag} from '../util/escape'

const e=makeEscapeTag(encodeURIComponent)

export type UserItemStreamResumeInfo = {
	lowerItemDate: Date,
	itemIdsWithLowerDate: Iterable<number>
}

abstract class UserItemStream<T> {
	private lowestTimestamp: number|undefined
	private visitedIds = new Set<number>()
	constructor(
		private readonly api: ApiProvider,
		protected userQuery: ValidUserQuery,
		resumeInfo?: UserItemStreamResumeInfo
	) {
		if (resumeInfo) {
			this.lowestTimestamp=resumeInfo.lowerItemDate.getTime()
			this.visitedIds=new Set(resumeInfo.itemIdsWithLowerDate)
		}
	}
	async fetch(): Promise<T[]> {
		const path=this.getFetchPath(this.nextFetchUpperBoundDate)
		let response: Response
		try {
			response=await this.api.fetch(path)
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
			this.modifyQueryInResponseToFetchedData(item)
			const id=this.getItemId(item)
			if (!this.visitedIds.has(id)) {
				newItems.push(item)
			}
			this.visitedIds.add(id)
			this.lowestTimestamp=this.getItemTimestamp(item)
		}
		return newItems
	}
	get nextFetchUpperBoundDate(): Date|null {
		if (this.lowestTimestamp) {
			return new Date(this.lowestTimestamp+1000)
		} else {
			return null
		}
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
	protected abstract getItemId(item: T): number
	protected abstract getItemTimestamp(item: T): number
}

export class UserChangesetStream extends UserItemStream<OsmChangesetApiData> {
	protected getFetchPath(upperBoundDate: Date|null): string {
		let timeParameter=''
		if (upperBoundDate) {
			timeParameter=e`&time=2001-01-01,${toIsoString(upperBoundDate)}`
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
	protected getItemTimestamp(changeset: OsmChangesetApiData): number {
		return Date.parse(changeset.created_at)
	}
}

export class UserNoteStream extends UserItemStream<OsmNoteApiData> {
	protected getFetchPath(upperBoundDate: Date|null): string {
		let timeParameter=''
		if (upperBoundDate) {
			timeParameter=e`&from=20010101T000000Z&to=${toIsoString(upperBoundDate,'','')}`
		}
		return `notes/search.json?${this.userParameter}&sort=created_at&order=newest&closed=-1${timeParameter}`
	}
	protected getOsmDataFromResponseJson(json: unknown): OsmNoteApiData[] {
		const notes=getNotesFromOsmApiResponse(json)
		return notes.filter(note=>{
			if (note.properties.comments.length==0) return false
			const [openingComment]=note.properties.comments
			if (openingComment.action!='opened') return false
			if (this.userQuery.type=='id') {
				return openingComment.uid==this.userQuery.uid
			} else {
				return openingComment.user==this.userQuery.username
			}
		})
	}
	protected getItemId(note: OsmNoteApiData): number {
		return note.properties.id
	}
	protected getItemTimestamp(note: OsmNoteApiData): number {
		return Date.parse(note.properties.date_created)
	}
}