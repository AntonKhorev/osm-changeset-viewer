import type {UserItemDbRecordMap, UserDbRecord, ChangesetDbRecord, NoteDbRecord} from '../db'
import {ChangesetViewerDBWriter} from '../db'
import type {ApiProvider} from '../net'
import {WorkerNet} from '../net'
import {WorkerBroadcastSender} from '../broadcast-channel'
import {ValidUserQuery, OsmChangesetApiData, getUserFromOsmApiResponse, hasBbox, OsmNoteApiData} from '../osm'
import type {UserStreamResumeInfo} from '../user-stream'
import {UserChangesetStream, UserNoteStream} from '../user-stream'
import {toReadableIsoString} from '../date'
import serverListConfig from '../server-list-config'
import {makeEscapeTag} from '../util/escape'

const e=makeEscapeTag(encodeURIComponent)

const net=new WorkerNet(serverListConfig)

type UserStreamMap = {
	changesets: UserChangesetStream
	notes: UserNoteStream
}

type UserItemOsmApiDataMap = {
	changesets: OsmChangesetApiData,
	notes: OsmNoteApiData
}

type HostDataEntry = {
	broadcastSender: WorkerBroadcastSender
	db: ChangesetViewerDBWriter
	userStreams: {
		changesets: Map<number,UserChangesetStream>
		notes: Map<number,UserNoteStream>
	}
}

const hostData=new Map<string,HostDataEntry>()

async function getHostDataEntry(host: string): Promise<HostDataEntry> {
	let hostDataEntry=hostData.get(host)
	if (!hostDataEntry) {
		hostDataEntry={
			broadcastSender: new WorkerBroadcastSender(host),
			db: await ChangesetViewerDBWriter.open(host),
			userStreams: {
				changesets: new Map(),
				notes: new Map()
			}
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
			let changesetStream: UserChangesetStream|undefined
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
				changesetStream=new UserChangesetStream(server.api,query)
				try {
					changesetsApiData=await changesetStream.fetch()
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
			if (changesetStream) {
				const changesets=changesetsApiData.map(convertChangesetApiDataToDbRecord)
				const restartedScan=await hostDataEntry.db.addUserItems('changesets',user.id,now,changesets,'toExistingScan')
				if (restartedScan) {
					hostDataEntry.userStreams.changesets.set(user.id,changesetStream)
				}
			}
			hostDataEntry.broadcastSender.postMessage({
				type,query,text,
				status: 'ready',
				user
			})
		} else if (type=='scanUserItems') {
			const host=ev.data.host
			if (typeof host != 'string') throw new TypeError(`invalid host type`)
			const start=ev.data.start
			if (typeof start != 'boolean') throw new TypeError(`invalid start type`)
			const itemType=ev.data.itemType
			if (typeof itemType != 'string') throw new TypeError(`invalid itemType type`)
			if (itemType!='changesets' && itemType!='notes') throw new TypeError(`invalid itemType value`)
			const uid=ev.data.uid
			if (typeof uid != 'number') throw new TypeError(`invalid uid type`)
			await scanUserItems(itemType,host,start,uid)
		}
	}
}

async function scanUserItems<T extends 'changesets'|'notes'>(itemType: T, host: string, start: boolean, uid: number): Promise<void> {
	const type='scanUserItems'
	const server=net.serverList.servers.get(host)
	if (!server) throw new RangeError(`unknown host "${host}"`)
	const hostDataEntry=await getHostDataEntry(host)
	const stream=await resumeUserStream(itemType,hostDataEntry,server.api,start,uid)
	const text=`${start?`start `:``}scan ${stream.nextFetchUpperBoundDate
		? `${itemType} before `+toReadableIsoString(stream.nextFetchUpperBoundDate)
		: `latest ${itemType}`
	} of user #${uid}`
	hostDataEntry.broadcastSender.postMessage({
		type,uid,text,
		status: 'running',
	})
	const now=new Date()
	let userItemsApiData=[] as UserItemOsmApiDataMap[T][]
	try {
		userItemsApiData=await stream.fetch() as UserItemOsmApiDataMap[T][]
	} catch (ex) {
		const failedText=(ex instanceof TypeError) ? ex.message : `unknown error`
		return hostDataEntry.broadcastSender.postMessage({
			type,uid,text,
			status: 'failed',
			failedText
		})
	}
	let userItems: UserItemDbRecordMap[T][]
	if (itemType=='changesets') {
		const changesetsApiData=userItemsApiData as OsmChangesetApiData[]
		const changesets=changesetsApiData.map(convertChangesetApiDataToDbRecord) as UserItemDbRecordMap[T][]
		userItems=changesets
	} else if (itemType=='notes') {
		const notesApiData=userItemsApiData as OsmNoteApiData[]
		const notes=notesApiData.map(convertNoteApiDataToDbRecord) as UserItemDbRecordMap[T][]
		userItems=notes
	} else {
		throw new RangeError(`unexpected item type`)
	}
	const mode=start?'toNewScan':'toNewOrExistingScan'
	await hostDataEntry.db.addUserItems(itemType,uid,now,userItems,mode)
	hostDataEntry.broadcastSender.postMessage({
		type,uid,text,
		status: 'ready'
	})
}

function makeNewUserStream<T extends 'changesets'|'notes'>(itemType: T, api: ApiProvider, uid: number, resumeInfo?: UserStreamResumeInfo): UserStreamMap[T] {
	if (itemType=='changesets') {
		return new UserChangesetStream(api,{type:'id',uid},resumeInfo) as UserStreamMap[T]
	} else if (itemType=='notes') {
		return new UserNoteStream(api,{type:'id',uid},resumeInfo) as UserStreamMap[T]
	} else {
		throw new RangeError(`unknown item type`)
	}
}

async function resumeUserStream<T extends 'changesets'|'notes'>(itemType: T, hostDataEntry: HostDataEntry, api: ApiProvider, start: boolean, uid: number): Promise<UserStreamMap[T]> {
	const userStreamsOfType=hostDataEntry.userStreams[itemType] as Map<number,UserStreamMap[T]>
	const makeAndRememberNewStream=(resumeInfo?:UserStreamResumeInfo)=>{
		const newStream=makeNewUserStream(itemType,api,uid,resumeInfo)
		userStreamsOfType.set(uid,newStream)
		return newStream
	}
	if (start) return makeAndRememberNewStream()
	return userStreamsOfType.get(uid) ?? makeAndRememberNewStream(
		await hostDataEntry.db.getUserStreamResumeInfo(itemType,uid)
	)
}

function convertChangesetApiDataToDbRecord(a: OsmChangesetApiData): ChangesetDbRecord {
	const b: ChangesetDbRecord = {
		id: a.id,
		uid: a.uid,
		createdAt: new Date(a.created_at),
		tags: a.tags ?? {},
		comments: {count:a.comments_count},
		changes: {count:a.changes_count}
	}
	if (a.closed_at!=null) {
		b.closedAt=new Date(a.closed_at)
	}
	if (hasBbox(a)) {
		b.bbox={
			minLat: a.minlat, maxLat: a.maxlat,
			minLon: a.minlon, maxLon: a.maxlon,
		}
	}
	return b
}

function convertNoteApiDataToDbRecord(a: OsmNoteApiData): NoteDbRecord {
	if (a.properties.comments.length==0) throw new RangeError(`unexpected note without comments`)
	const [c]=a.properties.comments
	if (c.uid==null) throw new RangeError(`unexpected note without an author`)
	const b: NoteDbRecord = {
		id: a.properties.id,
		uid: c.uid,
		createdAt: new Date(a.properties.date_created),
	}
	if (c.text!=null) {
		b.openingComment=c.text
	}
	return b
}
