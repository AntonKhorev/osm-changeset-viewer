import type {UserDbRecord} from '../db'
import ChangesetViewerDB from '../db'
import {WorkerNet} from '../net'
import {ValidUserQuery, OsmChangesetApiData, getUserFromOsmApiResponse} from '../osm'
import ChangesetStream from '../changeset-stream'
import serverListConfig from '../server-list-config'
import {makeEscapeTag} from '../util/escape'

const e=makeEscapeTag(encodeURIComponent)

const net=new WorkerNet(serverListConfig)

type HostDataEntry = {
	statusChannel: BroadcastChannel
	updateChannel: BroadcastChannel
	db: ChangesetViewerDB
	userChangesetStreams: Map<number,ChangesetStream>
}

const hostData=new Map<string,HostDataEntry>()

self.onconnect=ev=>{
	const port=ev.ports[0]
	port.onmessage=async(ev)=>{
		if (ev.data.type=='getUserInfo') {
			const host=ev.data.host
			const server=net.serverList.servers.get(host)
			if (!server) throw new RangeError(`unknown host "${host}"`)
			let hostDataEntry=hostData.get(host)
			if (!hostDataEntry) {
				hostDataEntry={
					statusChannel: new BroadcastChannel(`OsmChangesetViewerStatus[${host}]`),
					updateChannel: new BroadcastChannel(`OsmChangesetViewerUpdate[${host}]`),
					db: await ChangesetViewerDB.open(host),
					userChangesetStreams: new Map()
				}
			}
			const query=ev.data.query as ValidUserQuery
			let stream: ChangesetStream|undefined
			let changesets=[] as OsmChangesetApiData[]
			let uid: number|undefined
			if (query.type=='name') {
				hostDataEntry.statusChannel.postMessage(`getting info of user "${query.username}"`)
				try {
					stream=new ChangesetStream(server.api,query)
					changesets=await stream.fetch()
					if (changesets.length>0) {
						uid=changesets[0].uid
					}
				} catch {}
			} else if (query.type=='id') {
				hostDataEntry.statusChannel.postMessage(`getting info of user #${query.uid}`)
				uid=query.uid
			}
			if (uid==null) {
				hostDataEntry.updateChannel.postMessage({
					type: 'getUserInfo',
					query,
					status: 'failed',
					failure: 'uid'
				})
				return
			}
			let userDbRecord: UserDbRecord|undefined
			try {
				const now=new Date()
				const result=await server.api.fetch(e`user/${uid}.json`)
				if (!result.ok) {
					if (result.status==410) { // deleted user
						userDbRecord={
							id: uid,
							infoUpdatedAt: now,
							visible: false
						}
					}
				} else {
					const json=await result.json()
					const user=getUserFromOsmApiResponse(json)
					userDbRecord={
						id: uid,
						infoUpdatedAt: now,
						visible: true,
						name: user.display_name,
						createdAt: new Date(user.account_created),
						roles: user.roles,
						changesets: user.changesets,
						traces: user.traces,
						blocks: user.blocks
					}
					if (user.description!=null) userDbRecord.description=user.description
					if (user.img!=null) userDbRecord.img=user.img
				}
			} catch {}
			if (userDbRecord==null) {
				hostDataEntry.updateChannel.postMessage({
					type: 'getUserInfo',
					query,
					status: 'failed',
					failure: 'info'
				})
				return
			}
			hostDataEntry.db.putUser(userDbRecord)
			hostDataEntry.updateChannel.postMessage({
				type: 'getUserInfo',
				query,
				status: 'ready'
			})
		}
	}
}
