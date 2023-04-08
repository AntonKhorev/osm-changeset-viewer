import ChangesetViewerDB from '../db'
import {ValidUserQuery} from '../osm'

const broadcastChannel=new BroadcastChannel('OsmChangesetViewer')

type HostDataEntry = {
	db: ChangesetViewerDB
}

const hostData=new Map<string,HostDataEntry>()

self.onconnect=ev=>{
	const port=ev.ports[0]
	port.onmessage=async(ev)=>{
		if (ev.data.type=='getUserInfo') {
			const host=ev.data.host
			let hostDataEntry=hostData.get(host)
			if (!hostDataEntry) {
				const db=await ChangesetViewerDB.open(host)
				hostDataEntry={db}
			}
			const query=ev.data.query as ValidUserQuery
			if (query.type=='name') {
				broadcastChannel.postMessage(`getting info of user "${query.username}"`)
			} else if (query.type=='id') {
				broadcastChannel.postMessage(`getting info of user #${query.uid}`)
			}
		}
	}
}
