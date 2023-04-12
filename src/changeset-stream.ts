import {ApiProvider} from './net'
import {ValidUserQuery, OsmChangesetApiData, getChangesetsFromOsmApiResponse} from './osm'
import {toIsoString} from './date'
import {makeEscapeTag} from './util/escape'

export type ChangesetStreamResumeInfo = {
	lowerChangesetDate: Date,
	idsOfChangesetsWithLowerDate: Iterable<number>
}

export default class ChangesetStream {
	private lowestTimestamp: number|undefined
	private visitedChangesetIds = new Set<number>()
	constructor(
		private readonly api: ApiProvider,
		private userQuery: ValidUserQuery,
		resumeInfo?: ChangesetStreamResumeInfo
	) {
		if (resumeInfo) {
			this.lowestTimestamp=resumeInfo.lowerChangesetDate.getTime()
			this.visitedChangesetIds=new Set(resumeInfo.idsOfChangesetsWithLowerDate)
		}
	}
	async fetch(): Promise<OsmChangesetApiData[]> {
		const e=makeEscapeTag(encodeURIComponent)
		let userParameter: string
		if (this.userQuery.type=='id') {
			userParameter=e`user=${this.userQuery.uid}`
		} else {
			userParameter=e`display_name=${this.userQuery.username}`
		}
		let timeParameter=''
		const upperBoundDate=this.nextFetchUpperBoundDate
		if (upperBoundDate) {
			timeParameter=e`&time=2001-01-01,${toIsoString(upperBoundDate)}`
		}
		let response: Response
		try {
			response=await this.api.fetch(`changesets.json?${userParameter}${timeParameter}`)
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
		const changesets=getChangesetsFromOsmApiResponse(json)
		const newChangesets=[] as OsmChangesetApiData[]
		for (const changeset of changesets) {
			if (this.userQuery.type=='name') {
				this.userQuery={
					type: 'id',
					uid: changeset.uid
				}
			}
			if (!this.visitedChangesetIds.has(changeset.id)) {
				newChangesets.push(changeset)
			}
			this.visitedChangesetIds.add(changeset.id)
			this.lowestTimestamp=Date.parse(changeset.created_at)
		}
		return newChangesets
	}
	get nextFetchUpperBoundDate(): Date|null {
		if (this.lowestTimestamp) {
			return new Date(this.lowestTimestamp+1000)
		} else {
			return null
		}
	}
}
