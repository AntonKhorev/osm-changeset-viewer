import {ValidUserQuery} from './osm'

export type WorkerBroadcastMessageOperationPart = {
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
	} | {
		type: 'scanUserItems'
		uid: number
	}
)

type WorkerBroadcastMessageLogPart = {
	type: 'fetch'
	path: string
}

export type WorkerBroadcastMessage = {
	type: 'operation'
	part: WorkerBroadcastMessageOperationPart
} | {
	type: 'log'
	part: WorkerBroadcastMessageLogPart
}

class WorkerBroadcastChannel {
	protected broadcastChannel: BroadcastChannel
	constructor(host: string) {
		this.broadcastChannel=new BroadcastChannel(`OsmChangesetViewer[${host}]`)
	}
}

export class WorkerBroadcastSender extends WorkerBroadcastChannel {
	postMessage(message: WorkerBroadcastMessage): void {
		this.broadcastChannel.postMessage(message)
	}
	postOperationMessage(part: WorkerBroadcastMessageOperationPart): void {
		this.postMessage({
			type: 'operation',
			part
		})
	}
}

export class WorkerBroadcastReceiver extends WorkerBroadcastChannel {
	set onmessage(listener: (ev:MessageEvent<WorkerBroadcastMessage>)=>void) {
		this.broadcastChannel.onmessage=listener
	}
}
