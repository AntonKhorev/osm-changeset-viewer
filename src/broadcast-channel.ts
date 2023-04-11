import {ValidUserQuery} from './osm'
import type {UserDbRecord} from './db'

export type WorkerBroadcastChannelMessage = {
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
	(
		{
			type: 'getUserInfo'
			query: ValidUserQuery
		} & ({
			status: 'running'|'failed'
		} | {
			status: 'ready'
			user: UserDbRecord
		})
	) | (
		{
			type: 'startUserChangesetScan'|'continueUserChangesetScan'
			uid: number
			displayNumber: number
			status: 'running'|'failed'|'ready'
		}
	)
)

class WorkerBroadcastChannel {
	protected broadcastChannel: BroadcastChannel
	constructor(host: string) {
		this.broadcastChannel=new BroadcastChannel(`OsmChangesetViewer[${host}]`)
	}
}

export class WorkerBroadcastSender extends WorkerBroadcastChannel {
	postMessage(message: WorkerBroadcastChannelMessage) {
		this.broadcastChannel.postMessage(message)
	}
}

export class WorkerBroadcastReceiver extends WorkerBroadcastChannel {
	set onmessage(listener: (ev:MessageEvent<WorkerBroadcastChannelMessage>)=>void) {
		this.broadcastChannel.onmessage=listener
	}
}
