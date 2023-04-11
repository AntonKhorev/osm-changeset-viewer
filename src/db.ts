import type {ChangesetStreamResumeInfo} from './changeset-stream'

type Counter = {
	count: number
}
type ActiveCounter = Counter & {
	active: number
}
type Bbox = {
	minLat: number
	minLon: number
	maxLat: number
	maxLon: number
}

export type UserDbRecord = {
	id: number
	infoUpdatedAt: Date
} & ({
	visible: false // deleted account
} | {
	visible: true
	// api data except for id:
	name: string // "display_name" in api data - because sometimes it's "user" in other api data
	createdAt: Date // "account_created" in api data - because sometimes it's "created_at" in other api data
	description?: string
	img?: {
		href: string
	}
	roles: string[]
	changesets: Counter
	traces: Counter
	blocks: {
		received: ActiveCounter
		issued?: ActiveCounter
	}
})

export type UserChangesetScanDbRecord = {
	uid: number
	stash: number // 0 = current; 1 = stashed
	changesets: Counter
	beginDate: Date
	endDate?: Date
} & ({
	empty: true // without complete changeset requests or with empty results
} | {
	empty: false
	upperChangesetDate: Date
	lowerChangesetDate: Date
})

export type ChangesetDbRecord = {
	id: number
	uid: number
	tags: {[key:string]:string}
	createdAt: Date
	closedAt?: Date // open if undefined
	comments: Counter
	changes: Counter
	bbox?: Bbox
}

export class ChangesetViewerDBReader {
	protected closed: boolean = false
	constructor(protected idb: IDBDatabase) {
		idb.onversionchange=()=>{
			idb.close()
			this.closed=true
		}
	}
	getUserById(uid: number): Promise<UserDbRecord|undefined> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction('users','readonly')
			tx.onerror=()=>reject(new Error(`Database error in getUserById(): ${tx.error}`))
			const request=tx.objectStore('users').get(uid)
			request.onsuccess=()=>resolve(request.result)
		})
	}
	getUserByName(username: string): Promise<UserDbRecord|undefined> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction('users','readonly')
			tx.onerror=()=>reject(new Error(`Database error in getUserById(): ${tx.error}`))
			const request=tx.objectStore('users').index('name').get(username)
			request.onsuccess=()=>resolve(request.result)
		})
	}
	getCurrentUserChangesetScan(uid: number): Promise<UserChangesetScanDbRecord|undefined> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction('userChangesetScans','readonly')
			tx.onerror=()=>reject(new Error(`Database error in getCurrentUserChangesetScan(): ${tx.error}`))
			const request=tx.objectStore('userChangesetScans').get([uid,0])
			request.onsuccess=()=>resolve(request.result)
		})
	}
	// getChangesets(uid: number, limit: number, upperDate?: Date): Promise<ChangesetDbRecord[]> {
	// getChangesets(uid: number, limit: number, upperDate: Date): Promise<ChangesetDbRecord[]> {
	getChangesets(uid: number, limit: number, upperDate: Date, lowerDate: Date): Promise<ChangesetDbRecord[]> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction('changesets','readonly')
			tx.onerror=()=>reject(new Error(`Database error in getChangesets(): ${tx.error}`))
			// const range=(upperDate 
			// 	? IDBKeyRange.bound([uid],[uid,upperDate,+Infinity])
			// 	: IDBKeyRange.bound([uid],[uid+1])
			// )
			// const range=IDBKeyRange.bound([uid],[uid,upperDate,+Infinity])
			const range=IDBKeyRange.bound([uid,lowerDate],[uid,upperDate,+Infinity])
			const changesets=[] as ChangesetDbRecord[]
			tx.oncomplete=()=>resolve(changesets)
			const request=tx.objectStore('changesets').index('user').openCursor(range,'prev')
			request.onsuccess=()=>{
				const cursor=request.result
				if (!cursor) return
				changesets.push(cursor.value)
				if (changesets.length<limit) {
					cursor.continue()
				}
			}
		})
	}
	static open(host: string): Promise<ChangesetViewerDBReader> {
		return this.openWithType(host,idb=>new ChangesetViewerDBReader(idb))
	}
	protected static openWithType<T>(host: string, ctor: (idb:IDBDatabase)=>T): Promise<T> {
		return new Promise((resolve,reject)=>{
			const request=indexedDB.open(`OsmChangesetViewer[${host}]`)
			request.onsuccess=()=>{
				resolve(ctor(request.result))
			}
			request.onupgradeneeded=()=>{
				const idb=request.result
				const userStore=idb.createObjectStore('users',{keyPath:'id'})
				userStore.createIndex('name','name')
				idb.createObjectStore('userChangesetScans',{keyPath:['uid','stash']})
				const changesetStore=idb.createObjectStore('changesets',{keyPath:'id'})
				changesetStore.createIndex('user',['uid','createdAt','id'])
			}
			request.onerror=()=>{
				reject(new Error(`failed to open the database`))
			}
			request.onblocked=()=>{
				reject(new Error(`failed to open the database because of blocked version change`)) // shouldn't happen
			}
		})
	}
}

export class ChangesetViewerDBWriter extends ChangesetViewerDBReader {
	putUser(user: UserDbRecord): Promise<void> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction('users','readwrite')
			tx.onerror=()=>reject(new Error(`Database error in putUser(): ${tx.error}`))
			tx.objectStore('users').put(user).onsuccess=()=>resolve()
		})
	}
	/*
	startUserChangesetScan(uid: number, beginDate: Date): Promise<void> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction('userChangesetScans','readwrite')
			tx.onerror=()=>reject(new Error(`Database error in startUserChangesetScan(): ${tx.error}`))
			const scan: UserChangesetScanDbRecord = {
				uid,
				stash: 0,
				changesets: {count:0},
				beginDate,
				empty: true
			}
			tx.objectStore('userChangesetScans').put(scan).onsuccess=()=>resolve()
		})
	}
	*/
	getChangesetStreamResumeInfo(uid: number): Promise<ChangesetStreamResumeInfo|undefined> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction(['changesets','userChangesetScans'],'readonly')
			tx.onerror=()=>reject(new Error(`Database error in getEarliestScanChangesests(): ${tx.error}`))
			const scanRequest=tx.objectStore('userChangesetScans').get([uid,0])
			scanRequest.onsuccess=()=>{
				if (scanRequest.result==null) {
					return resolve(undefined)
				}
				const scan=scanRequest.result as UserChangesetScanDbRecord
				if (scan.empty) {
					return resolve(undefined)
				}
				const changesetsRequest=tx.objectStore('changesets').index('user').getAll(
					IDBKeyRange.bound([uid,scan.lowerChangesetDate],[uid,scan.lowerChangesetDate,+Infinity])
				)
				changesetsRequest.onsuccess=()=>{
					let lowerChangesetDate: Date|undefined
					const idsOfChangesetsWithLowerDate=changesetsRequest.result.map((changeset:ChangesetDbRecord)=>{
						if (!lowerChangesetDate || lowerChangesetDate.getTime()>changeset.createdAt.getTime()) {
							lowerChangesetDate=changeset.createdAt
						}
						return changeset.id
					})
					if (lowerChangesetDate) {
						resolve({lowerChangesetDate,idsOfChangesetsWithLowerDate})
					} else {
						resolve(undefined)
					}
				}
			}
		})
	}
	/**
	 * @returns true if decided to add/update the scan
	 */
	addUserChangesets(
		uid: number, beginDate: Date, changesets: ChangesetDbRecord[],
		mode: 'toNewScan'|'toExistingScan'|'toNewOrExistingScan'
	): Promise<boolean> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction(['changesets','userChangesetScans'],'readwrite')
			tx.onerror=()=>reject(new Error(`Database error in addCurrentUserChangesetScan(): ${tx.error}`))
			const handleScan=(scan: UserChangesetScanDbRecord)=>{
				for (const changeset of changesets) {
					tx.objectStore('changesets').put(changeset)
					if (scan.empty) {
						scan={
							...scan,
							empty: false,
							upperChangesetDate: changeset.createdAt,
							lowerChangesetDate: changeset.createdAt
						}
					} else {
						if (scan.upperChangesetDate.getTime()<changeset.createdAt.getTime()) {
							scan.upperChangesetDate=changeset.createdAt
						}
						if (scan.lowerChangesetDate.getTime()>changeset.createdAt.getTime()) {
							scan.lowerChangesetDate=changeset.createdAt
						}
					}
					scan.changesets.count++
				}
				tx.objectStore('userChangesetScans').put(scan)
				tx.oncomplete=()=>resolve(true)
			}
			const makeEmptyScan=():UserChangesetScanDbRecord=>({
				uid,
				stash: 0,
				changesets: {count:0},
				beginDate,
				empty: true
			})
			if (mode=='toNewScan') {
				handleScan(makeEmptyScan())
			} else {
				const getScanRequest=tx.objectStore('userChangesetScans').get([uid,0])
				getScanRequest.onsuccess=ev=>{
					let scan: UserChangesetScanDbRecord
					if (getScanRequest.result==null) {
						scan=makeEmptyScan()
					} else {
						if (mode=='toExistingScan') {
							return resolve(false)
						}
						scan=getScanRequest.result
					}
					handleScan(scan)
				}
			}
		})
	}
	static open(host: string): Promise<ChangesetViewerDBWriter> {
		return this.openWithType(host,idb=>new ChangesetViewerDBWriter(idb))
	}
}
