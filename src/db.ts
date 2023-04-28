import StreamBoundary from './stream-boundary'

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
	stash: number // 0 = current; 1 = stashed
	type: keyof UserItemDbRecordMap
	items: Counter
	beginDate: Date
	endDate?: Date
} & ({
	empty: true // without complete changeset requests or with empty results
} | {
	empty: false
	upperItemDate: Date
	upperItemIds: number[]
	lowerItemDate: Date
	lowerItemIds: number[]
})
export type NonEmptyUserScanDbRecord = Extract<UserScanDbRecord,{empty:false}>

export type UserDbInfo = {
	user: UserDbRecord
	scans: Partial<{[key in UserScanDbRecord['type']]: UserScanDbRecord}>
}

class ScanBoundary {
	private readonly upperItemIds: Set<number>
	private readonly lowerItemIds: Set<number>
	private readonly upperItemTimestamp: number
	private readonly lowerItemTimestamp: number
	constructor(scan: NonEmptyUserScanDbRecord) {
		this.upperItemIds=new Set(scan.upperItemIds)
		this.lowerItemIds=new Set(scan.lowerItemIds)
		this.upperItemTimestamp=scan.upperItemDate.getTime()
		this.lowerItemTimestamp=scan.lowerItemDate.getTime()
		if (this.lowerItemTimestamp>this.upperItemTimestamp) {
			throw new RangeError(`invalid scan range`)
		}
	}
	get upperItemDate(): Date {
		return new Date(this.upperItemTimestamp)
	}
	get lowerItemDate(): Date {
		return new Date(this.lowerItemTimestamp)
	}
	getItemKeyRange(uid: number, streamBoundary: StreamBoundary): IDBKeyRange {
		return IDBKeyRange.bound(
			[uid,this.lowerItemDate],
			[uid,streamBoundary.getOwnOrLowerDate(this.upperItemDate),+Infinity]
		)
	}
	isItemInside(item: UserItemDbRecord): boolean {
		const itemTimestamp=item.createdAt.getTime()
		if (
			itemTimestamp<this.lowerItemTimestamp ||
			itemTimestamp>this.upperItemTimestamp
		) {
			return false
		}
		if (
			itemTimestamp==this.upperItemTimestamp &&
			!this.upperItemIds.has(item.id)
		) {
			return false
		}
		if (
			itemTimestamp==this.lowerItemTimestamp &&
			!this.lowerItemIds.has(item.id)
		) {
			return false
		}
		return true
	}
}

export class ChangesetViewerDBReader {
	protected closed: boolean = false
	constructor(protected idb: IDBDatabase) {
		idb.onversionchange=()=>{
			idb.close()
			this.closed=true
		}
	}
	getUserInfoById(uid: number): Promise<UserDbInfo|undefined> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction(['users','userScans'],'readonly')
			tx.onerror=()=>reject(new Error(`Database error in getUserById(): ${tx.error}`))
			const request=tx.objectStore('users').get(uid)
			request.onsuccess=()=>{
				this.getPromisedUserWithScans(resolve,tx,request.result)
			}
		})
	}
	getUserInfoByName(username: string): Promise<UserDbInfo|undefined> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction(['users','userScans'],'readonly')
			tx.onerror=()=>reject(new Error(`Database error in getUserById(): ${tx.error}`))
			const request=tx.objectStore('users').index('name').get(username)
			request.onsuccess=()=>{
				this.getPromisedUserWithScans(resolve,tx,request.result)
			}
		})
	}
	private getPromisedUserWithScans(resolve: (value:UserDbInfo|undefined)=>void, tx: IDBTransaction, user: UserDbRecord|undefined): void {
		if (!user) {
			return resolve(undefined)
		}
		const request=tx.objectStore('userScans').getAll(
			IDBKeyRange.bound([user.id,0],[user.id,1],false,true)
		)
		request.onsuccess=()=>{
			const scans: UserDbInfo['scans'] = {}
			for (const scan of request.result as UserScanDbRecord[]) {
				scans[scan.type]=scan
			}
			return resolve({user,scans})
		}
	}
	getCurrentUserScan(type: keyof UserItemDbRecordMap, uid: number): Promise<UserScanDbRecord|undefined> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction('userScans','readonly')
			tx.onerror=()=>reject(new Error(`Database error in getCurrentUserScan(): ${tx.error}`))
			const request=tx.objectStore('userScans').get([uid,0,type])
			request.onsuccess=()=>resolve(request.result)
		})
	}
	getUserItems<T extends keyof UserItemDbRecordMap>(
		type: T, uid: number, scan: UserScanDbRecord, streamBoundary: StreamBoundary, limit: number
	): Promise<UserItemDbRecordMap[T][]> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const returnItems=(items:UserItemDbRecordMap[T][])=>{
				if (items.length==0 && !scan.empty) { // can also check if items.length<limit
					streamBoundary.advance(scan.lowerItemDate)
				} else if (scan.endDate) {
					streamBoundary.finish()
				}
				return resolve(items)
			}
			if (scan.empty) {
				return returnItems([])
			}
			const tx=this.idb.transaction(type,'readonly')
			tx.onerror=()=>reject(new Error(`Database error in getUserItems(): ${tx.error}`))
			const items=[] as UserItemDbRecordMap[T][]
			tx.oncomplete=()=>returnItems(items)
			const scanBoundary=new ScanBoundary(scan)
			const range=scanBoundary.getItemKeyRange(uid,streamBoundary)
			const request=tx.objectStore(type).index('user').openCursor(range,'prev')
			request.onsuccess=()=>{
				const cursor=request.result
				if (!cursor) return
				const item=cursor.value as UserItemDbRecordMap[T]
				if (scanBoundary.isItemInside(item) && streamBoundary.visit(item.createdAt,item.id)) {
					items.push(item)
				}
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
				idb.createObjectStore('userScans',{keyPath:['uid','stash','type']})
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
