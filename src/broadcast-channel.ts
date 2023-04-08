import {ValidUserQuery} from './osm'
import type {UserDbRecord} from './db'

type Message = {
	text: string
} & (
	{
		status: 'running'
	} | {
		status: 'failed'
		failedText: string
	} | {
		status: 'ready'
	}
) & (
	{
		type: 'getUserInfo'
		query: ValidUserQuery
	} & ({
		status: 'running'|'failed'
	} | {
		status: 'ready'
		user: UserDbRecord
	})
)

class WorkerBroadcastChannel {
	protected broadcastChannel: BroadcastChannel
	constructor(host: string) {
		this.broadcastChannel=new BroadcastChannel(`OsmChangesetViewer[${host}]`)
	}
}

export class WorkerBroadcastSender extends WorkerBroadcastChannel {
	postMessage(message: Message) {
		this.broadcastChannel.postMessage(message)
	}
}

export class WorkerBroadcastReceiver extends WorkerBroadcastChannel {
	set onmessage(listener: (ev:MessageEvent<Message>)=>void) {
		this.broadcastChannel.onmessage=listener
	}
}
