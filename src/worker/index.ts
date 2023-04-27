import type {Server} from '../net'
import type {UserItemDbRecordMap, UserDbRecord, ChangesetDbRecord, NoteDbRecord} from '../db'
import {ChangesetViewerDBWriter} from './db-writer'
import type {ApiProvider} from '../net'
import {WorkerNet} from '../net'
import {WorkerBroadcastSender} from '../broadcast-channel'
import {ValidUserQuery, OsmChangesetApiData, getUserFromOsmApiResponse, hasBbox, OsmNoteApiData} from '../osm'
import StreamBoundary from '../stream-boundary'
import {UserChangesetStream, UserNoteStream, parseNoteDate} from './user-item-stream'
import {toReadableIsoString} from '../date'
import serverListConfig from '../server-list-config'
import {makeEscapeTag} from '../util/escape'

const e=makeEscapeTag(encodeURIComponent)

const net=new WorkerNet(serverListConfig)

type UserItemStreamMap = {
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

function getLoggedFetcher(server: Server, hostDataEntry: HostDataEntry): (path:string)=>Promise<Response> {
	return path=>{
		hostDataEntry.broadcastSender.postMessage({
			type: 'log',
			part: {
				type: 'fetch',
				path
			}
		})
		return server.api.fetch(path)
	}
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
			const fetcher=getLoggedFetcher(server,hostDataEntry)
			const query=ev.data.query as ValidUserQuery
			let changesetStream: UserChangesetStream|undefined
			let changesetsApiData=[] as OsmChangesetApiData[]
			let uid: number|undefined
			let text=`info of unknown user`
			let failedText=`unable to get user id`
			if (query.type=='name') {
				text=`info of user "${query.username}"`
				hostDataEntry.broadcastSender.postOperationMessage({
					type,query,text,
					status: 'running',
				})
				changesetStream=new UserChangesetStream(query)
				try {
					changesetsApiData=await changesetStream.fetch(fetcher)
				} catch (ex) {
					if (ex instanceof TypeError) {
						failedText+=` because: ${ex.message}`
					}
				}
				if (changesetsApiData.length>0) {
					uid=changesetsApiData[0].uid
				} else {
					failedText+=` because user has no changesets`
				}
			} else if (query.type=='id') {
				text=`info of user #${query.uid}`
				hostDataEntry.broadcastSender.postMessage({type:'operation',part:{
					type,query,text,
					status: 'running',
				}})
				uid=query.uid
			}
			if (uid==null) {
				return hostDataEntry.broadcastSender.postOperationMessage({
					type,query,text,
					status: 'failed',
					failedText
				})
			}
			failedText=`unable to get user info for given id`
			let user: UserDbRecord|undefined
			const now=new Date()
			try {
				const response=await fetcher(e`user/${uid}.json`)
				if (!response.ok) {
					if (response.status==410) { // deleted user
						user={
							id: uid,
							infoUpdatedAt: now,
							visible: false
						}
					} else if (response.status==404) {
						failedText+=` because it doesn't exist`
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
				return hostDataEntry.broadcastSender.postOperationMessage({
					type,query,text,
					status: 'failed',
					failedText
				})
			}
			await hostDataEntry.db.putUser(user)
			if (changesetStream) {
				const changesets=changesetsApiData.map(convertChangesetApiDataToDbRecord)
				const restartedScan=await hostDataEntry.db.addUserItems('changesets',user.id,now,changesets,changesetStream.isEnded,'toExistingScan')
				if (restartedScan) {
					hostDataEntry.userStreams.changesets.set(user.id,changesetStream)
				}
			}
			hostDataEntry.broadcastSender.postOperationMessage({
				type,query,text,
				status: 'ready'
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
	const fetcher=getLoggedFetcher(server,hostDataEntry)
	const stream=await resumeUserItemStream(itemType,hostDataEntry,server.api,start,uid)
	const text=`${start?`start `:``}scan ${stream.nextFetchUpperBoundDate
		? `${itemType} before `+toReadableIsoString(stream.nextFetchUpperBoundDate)
		: `latest ${itemType}`
	} of user #${uid}`
	hostDataEntry.broadcastSender.postOperationMessage({
		type,uid,text,
		status: 'running',
	})
	const now=new Date()
	let userItemsApiData=[] as UserItemOsmApiDataMap[T][]
	try {
		userItemsApiData=await stream.fetch(fetcher) as UserItemOsmApiDataMap[T][]
	} catch (ex) {
		const failedText=(ex instanceof TypeError) ? ex.message : `unknown error`
		return hostDataEntry.broadcastSender.postOperationMessage({
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
	await hostDataEntry.db.addUserItems(itemType,uid,now,userItems,stream.isEnded,mode)
	hostDataEntry.broadcastSender.postOperationMessage({
		type,uid,text,
		status: 'ready'
	})
}

function makeNewUserItemStream<T extends 'changesets'|'notes'>(
	itemType: T, api: ApiProvider, uid: number, streamBoundary?: StreamBoundary
): UserItemStreamMap[T] {
	if (itemType=='changesets') {
		return new UserChangesetStream({type:'id',uid},streamBoundary) as UserItemStreamMap[T]
	} else if (itemType=='notes') {
		return new UserNoteStream({type:'id',uid},streamBoundary) as UserItemStreamMap[T]
	} else {
		throw new RangeError(`unknown item type`)
	}
}

async function resumeUserItemStream<T extends 'changesets'|'notes'>(
	itemType: T, hostDataEntry: HostDataEntry, api: ApiProvider, start: boolean, uid: number
): Promise<UserItemStreamMap[T]> {
	const userStreamsOfType=hostDataEntry.userStreams[itemType] as Map<number,UserItemStreamMap[T]>
	const makeAndRememberNewStream=(streamBoundary?: StreamBoundary)=>{
		const newStream=makeNewUserItemStream(itemType,api,uid,streamBoundary)
		userStreamsOfType.set(uid,newStream)
		return newStream
	}
	if (start) return makeAndRememberNewStream()
	return userStreamsOfType.get(uid) ?? makeAndRememberNewStream(
		await hostDataEntry.db.getUserItemStreamBoundary(itemType,uid)
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
		createdAt: parseNoteDate(a.properties.date_created),
	}
	if (c.text!=null) {
		b.openingComment=c.text
	}
	return b
}
