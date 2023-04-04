import {Connection} from './net'
import {ValidUserQuery, OsmChangesetApiData, getChangesetsFromOsmApiResponse} from './osm'
import {toIsoString} from './date'
import {makeEscapeTag} from './util/escape'

export default class ChangesetStream {
	private lowestTimestamp: number|undefined
	private visitedChangesetIds = new Set<number>()
	constructor(
		private readonly cx: Connection,
		private userQuery: ValidUserQuery,
		visitedChangesets?: Iterable<OsmChangesetApiData>
	) {
		if (visitedChangesets) {
			for (const changeset of visitedChangesets) {
				this.visitChangeset(changeset)
			}
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
		if (this.lowestTimestamp) {
			const upperBoundDate=new Date(this.lowestTimestamp+1000)
			timeParameter=e`&time=2001-01-01,${toIsoString(upperBoundDate)}`
		}
		const result=await this.cx.server.api.fetch(`changesets.json?${userParameter}${timeParameter}`)
		const json=await result.json()
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
			this.visitChangeset(changeset)
		}
		return newChangesets
	}
	private visitChangeset(changeset: OsmChangesetApiData) {
		this.visitedChangesetIds.add(changeset.id)
		this.lowestTimestamp=Date.parse(changeset.created_at)
	}
}
