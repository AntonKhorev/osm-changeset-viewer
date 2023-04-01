import {Connection} from './net'
import {ValidUserQuery, OsmChangesetApiData, getChangesetsFromOsmApiResponse} from './osm'
import {toIsoString} from './date'
import {makeEscapeTag} from './util/escape'

export default class ChangesetStream {
	private lowestTimestamp: number|undefined
	private visitedChangesetIds = new Set<number>()
	constructor(
		private readonly cx: Connection,
		private readonly userQuery: ValidUserQuery
	) {}
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
			if (!this.visitedChangesetIds.has(changeset.id)) {
				this.visitedChangesetIds.add(changeset.id)
				newChangesets.push(changeset)
			}
			this.lowestTimestamp=Date.parse(changeset.created_at)
		}
		return newChangesets
	}
}
