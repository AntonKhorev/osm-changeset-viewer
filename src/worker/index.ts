import type {UserDbRecord, ChangesetDbRecord} from '../db'
import {ChangesetViewerDBWriter} from '../db'
import {WorkerNet} from '../net'
import {WorkerBroadcastSender} from '../broadcast-channel'
import {ValidUserQuery, OsmChangesetApiData, getUserFromOsmApiResponse, hasBbox} from '../osm'
import ChangesetStream from '../changeset-stream'
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
	return hostData.get(host) ?? {
		broadcastSender: new WorkerBroadcastSender(host),
		db: await ChangesetViewerDBWriter.open(host),
		userChangesetStreams: new Map()
	}
}

self.onconnect=ev=>{
	const port=ev.ports[0]
	port.onmessage=async(ev)=>{
		const type=ev.data.type
		if (type=='getUserInfo') {
			const host=ev.data.host
			const server=net.serverList.servers.get(host)
			if (!server) throw new RangeError(`unknown host "${host}"`)
			const hostDataEntry=await getHostDataEntry(host)
			const query=ev.data.query as ValidUserQuery
			let stream: ChangesetStream|undefined
			let changesetsApiData=[] as OsmChangesetApiData[]
			let uid: number|undefined
			let text=`info of unknown user`
			if (query.type=='name') {
				text=`info of user "${query.username}"`
				hostDataEntry.broadcastSender.postMessage({
					type,query,text,
					status: 'running',
				})
				try {
					stream=new ChangesetStream(server.api,query)
					changesetsApiData=await stream.fetch()
					if (changesetsApiData.length>0) {
						uid=changesetsApiData[0].uid
					}
				} catch {}
			} else if (query.type=='id') {
				text=`info of user #${query.uid}`
				hostDataEntry.broadcastSender.postMessage({
					type,query,text,
					status: 'running',
				})
				uid=query.uid
			}
			if (uid==null) {
				hostDataEntry.broadcastSender.postMessage({
					type,query,text,
					status: 'failed',
					failedText: 'unable to get user id'
				})
				return
			}
			let user: UserDbRecord|undefined
			const now=new Date()
			try {
				const result=await server.api.fetch(e`user/${uid}.json`)
				if (!result.ok) {
					if (result.status==410) { // deleted user
						user={
							id: uid,
							infoUpdatedAt: now,
							visible: false
						}
					}
				} else {
					const json=await result.json()
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
				hostDataEntry.broadcastSender.postMessage({
					type,query,text,
					status: 'failed',
					failedText: 'unable to get user info'
				})
				return
			}
			await hostDataEntry.db.putUser(user)
			if (stream) {
				const changesets=changesetsApiData.map((a):ChangesetDbRecord=>{
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
				})
				const restartedScan=await hostDataEntry.db.addUserChangesets(user.id,now,changesets,true)
				if (restartedScan) {
					hostDataEntry.userChangesetStreams.set(user.id,stream)
				}
			}
			hostDataEntry.broadcastSender.postMessage({
				type,query,text,
				status: 'ready',
				user
			})
		} else if (type=='startUserChangesetScan') {
			const host=ev.data.host
			const server=net.serverList.servers.get(host)
			if (!server) throw new RangeError(`unknown host "${host}"`)
			const hostDataEntry=await getHostDataEntry(host)
		}
	}
}
