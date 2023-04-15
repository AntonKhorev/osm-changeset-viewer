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

type UserItemDbRecord = {
	id: number
	uid: number // we get only notes of known users for now
	createdAt: Date
}

export type ChangesetDbRecord = UserItemDbRecord & {
	tags: {[key:string]:string}
	closedAt?: Date // open if undefined
	comments: Counter
	changes: Counter
	bbox?: Bbox
}

export type NoteDbRecord = UserItemDbRecord & {
	openingComment?: string
}

export type UserItemDbRecordMap = {
	changesets: ChangesetDbRecord
	notes: NoteDbRecord
}

export type UserScanDbRecord = {
	uid: number
	type: keyof UserItemDbRecordMap
	stash: number // 0 = current; 1 = stashed
	items: Counter
	beginDate: Date
	endDate?: Date
} & ({
	empty: true // without complete changeset requests or with empty results
} | {
	empty: false
	upperItemDate: Date
	lowerItemDate: Date
})

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
	getCurrentUserScan(type: keyof UserItemDbRecordMap, uid: number): Promise<UserScanDbRecord|undefined> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction('userScans','readonly')
			tx.onerror=()=>reject(new Error(`Database error in getCurrentUserScan(): ${tx.error}`))
			const request=tx.objectStore('userScans').get([uid,type,0])
			request.onsuccess=()=>resolve(request.result)
		})
	}
	getUserItems<T extends keyof UserItemDbRecordMap>(
		type: T, uid: number, limit: number, upperDate: Date, lowerDate: Date
	): Promise<UserItemDbRecordMap[T][]> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction(type,'readonly')
			tx.onerror=()=>reject(new Error(`Database error in getUserItems(): ${tx.error}`))
			const range=IDBKeyRange.bound([uid,lowerDate],[uid,upperDate,+Infinity])
			const items=[] as UserItemDbRecordMap[T][]
			tx.oncomplete=()=>resolve(items)
			const request=tx.objectStore(type).index('user').openCursor(range,'prev')
			request.onsuccess=()=>{
				const cursor=request.result
				if (!cursor) return
				items.push(cursor.value)
				if (items.length<limit) {
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
				idb.createObjectStore('userScans',{keyPath:['uid','type','stash']})
				const changesetStore=idb.createObjectStore('changesets',{keyPath:'id'})
				changesetStore.createIndex('user',['uid','createdAt','id'])
				const noteStore=idb.createObjectStore('notes',{keyPath:'id'})
				noteStore.createIndex('user',['uid','createdAt','id'])
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
