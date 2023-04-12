import type {UserDbRecord, ChangesetDbRecord} from '../db'
import {ChangesetViewerDBWriter} from '../db'
import {WorkerNet} from '../net'
import {WorkerBroadcastSender} from '../broadcast-channel'
import {ValidUserQuery, OsmChangesetApiData, getUserFromOsmApiResponse, hasBbox} from '../osm'
import ChangesetStream from '../changeset-stream'
import {toReadableIsoString} from '../date'
import serverListConfig from '../server-list-config'
import {makeEscapeTag} from '../util/escape'

const e=makeEscapeTag(encodeURIComponent)

const net=new WorkerNet(serverListConfig)

type HostDataEntry = {
	broadcastSender: WorkerBroadcastSender
	db: ChangesetViewerDBWriter
	userChangesetStreams: Map<number,ChangesetStream>
}

const hostData=new Map<string,HostDataEntry>()

async function getHostDataEntry(host: string): Promise<HostDataEntry> {
	let hostDataEntry=hostData.get(host)
	if (!hostDataEntry) {
		hostDataEntry={
			broadcastSender: new WorkerBroadcastSender(host),
			db: await ChangesetViewerDBWriter.open(host),
			userChangesetStreams: new Map()
		}
		hostData.set(host,hostDataEntry)
	}
	return hostDataEntry
}

self.onconnect=ev=>{
	const port=ev.ports[0]
	port.onmessage=async(ev)=>{
		const type=ev.data.type
		if (typeof type != 'string') throw new TypeError(`invalid message type`)
		if (type=='getUserInfo') {
			const host=ev.data.host
			if (typeof host != 'string') throw new TypeError(`invalid host type`)
			const server=net.serverList.servers.get(host)
			if (!server) throw new RangeError(`unknown host "${host}"`)
			const hostDataEntry=await getHostDataEntry(host)
			const query=ev.data.query as ValidUserQuery
			let stream: ChangesetStream|undefined
			let changesetsApiData=[] as OsmChangesetApiData[]
			let uid: number|undefined
			let text=`info of unknown user`
			let failedText=`unable to get user id`
			if (query.type=='name') {
				text=`info of user "${query.username}"`
				hostDataEntry.broadcastSender.postMessage({
					type,query,text,
					status: 'running',
				})
				stream=new ChangesetStream(server.api,query)
				try {
					changesetsApiData=await stream.fetch()
				} catch (ex) {
					if (ex instanceof TypeError) {
						failedText+=` because: ${ex.message}`
					}
				}
				if (changesetsApiData.length>0) {
					uid=changesetsApiData[0].uid
				}
			} else if (query.type=='id') {
				text=`info of user #${query.uid}`
				hostDataEntry.broadcastSender.postMessage({
					type,query,text,
					status: 'running',
				})
				uid=query.uid
			}
			if (uid==null) {
				return hostDataEntry.broadcastSender.postMessage({
					type,query,text,
					status: 'failed',
					failedText
				})
			}
			let user: UserDbRecord|undefined
			const now=new Date()
			try {
				const response=await server.api.fetch(e`user/${uid}.json`)
				if (!response.ok) {
					if (response.status==410) { // deleted user
						user={
							id: uid,
							infoUpdatedAt: now,
							visible: false
						}
					}
				} else {
					const json=await response.json()
					const userApiData=getUserFromOsmApiResponse(json)
					user={
						id: uid,
						infoUpdatedAt: now,
						visible: true,
						name: userApiData.display_name,
						createdAt: new Date(userApiData.account_created),
						roles: userApiData.roles,
						changesets: userApiData.changesets,
						traces: userApiData.traces,
						blocks: userApiData.blocks
					}
					if (userApiData.description!=null) user.description=userApiData.description
					if (userApiData.img!=null) user.img=userApiData.img
				}
			} catch {}
			if (user==null) {
				return hostDataEntry.broadcastSender.postMessage({
					type,query,text,
					status: 'failed',
					failedText
				})
			}
			await hostDataEntry.db.putUser(user)
			if (stream) {
				const changesets=changesetsApiData.map(convertChangesetApiDataToDbRecord)
				const restartedScan=await hostDataEntry.db.addUserChangesets(user.id,now,changesets,'toExistingScan')
				if (restartedScan) {
					hostDataEntry.userChangesetStreams.set(user.id,stream)
				}
			}
			hostDataEntry.broadcastSender.postMessage({
				type,query,text,
				status: 'ready',
				user
			})
		} else if (
			type=='startUserChangesetScan' ||
			type=='continueUserChangesetScan'
		) {
			const host=ev.data.host
			if (typeof host != 'string') throw new TypeError(`invalid host type`)
			const uid=ev.data.uid
			if (typeof uid != 'number') throw new TypeError(`invalid uid type`)
			const server=net.serverList.servers.get(host)
			if (!server) throw new RangeError(`unknown host "${host}"`)
			const hostDataEntry=await getHostDataEntry(host)
			let stream: ChangesetStream|undefined
			if (type=='startUserChangesetScan') {
				stream=new ChangesetStream(server.api,{type:'id',uid})
			} else {
				stream=hostDataEntry.userChangesetStreams.get(uid)
				if (!stream) {
					const resumeInfo=await hostDataEntry.db.getChangesetStreamResumeInfo(uid)
					stream=new ChangesetStream(server.api,{type:'id',uid},resumeInfo)
				}
			}
			const text=`${type=='startUserChangesetScan'?`start `:``}scan ${
				stream.nextFetchUpperBoundDate?`changesets before `+toReadableIsoString(stream.nextFetchUpperBoundDate):`latest changesets`
			} of user #${uid}`
			hostDataEntry.broadcastSender.postMessage({
				type,uid,text,
				status: 'running',
			})
			let changesetsApiData=[] as OsmChangesetApiData[]
			const now=new Date()
			try {
				changesetsApiData=await stream.fetch()
			} catch (ex) {
				const failedText=(ex instanceof TypeError) ? ex.message : `unknown error`
				return hostDataEntry.broadcastSender.postMessage({
					type,uid,text,
					status: 'failed',
					failedText
				})
			}
			const changesets=changesetsApiData.map(convertChangesetApiDataToDbRecord)
			const mode=(type=='startUserChangesetScan'
				? 'toNewScan'
				: 'toNewOrExistingScan'
			)
			await hostDataEntry.db.addUserChangesets(uid,now,changesets,mode)
			hostDataEntry.userChangesetStreams.set(uid,stream)
			hostDataEntry.broadcastSender.postMessage({
				type,uid,text,
				status: 'ready'
			})
			// TODO mark scan as completed
		}
	}
}

function convertChangesetApiDataToDbRecord(a: OsmChangesetApiData): ChangesetDbRecord {
	const b: ChangesetDbRecord = {
		id: a.id,
		uid: a.uid,
		tags: a.tags ?? {},
		createdAt: new Date(a.created_at),
		comments: {count:a.comments_count},
		changes: {count:a.changes_count}
	}
	if (hasBbox(a)) {
		b.bbox={
			minLat: a.minlat, maxLat: a.maxlat,
			minLon: a.minlon, maxLon: a.maxlon,
		}
	}
	return b
}
