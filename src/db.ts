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
	completed: boolean
	beginDate: Date
	endDate?: Date
	changesets: Counter
	earliestChangesetDate?: Date
}

export type ChangesetDbRecord = {
	id: number
	uid: number
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
				idb.createObjectStore('userChangesetScans',{keyPath:['uid','completed']})
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
			const request=tx.objectStore('users').put(user)
			request.onsuccess=()=>resolve()
		})
	}
	static open(host: string): Promise<ChangesetViewerDBWriter> {
		return this.openWithType(host,idb=>new ChangesetViewerDBWriter(idb))
	}
}
