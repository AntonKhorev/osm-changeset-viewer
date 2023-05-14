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
	nameUpdatedAt: Date
	name?: string // "display_name" in api data - because sometimes it's "user" in other api data - or nothing if we know that the user is deleted (but maybe we keep last known name of deleted users?)
} & (
	{
		withDetails: false
	} | {
		withDetails: true
		detailsUpdatedAt: Date
	} & (
		{
			visible: false // deleted account
		} | {
			visible: true
			// api data except for id and name:
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
		}
	)
)

export type UserItemCommentDbRecord = {
	itemId: number
	order: number
	itemUid: number
	uid?: number
	createdAt: Date
	text: string
}

export type ChangesetCommentDbRecord = UserItemCommentDbRecord

export type NoteCommentDbRecord = UserItemCommentDbRecord & {
	action: 'opened' | 'closed' | 'reopened' | 'commented' | 'hidden'
}

export type UserItemCommentDbRecordMap = {
	changesets: ChangesetCommentDbRecord
	notes: NoteCommentDbRecord
}

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

export type UserItemDbInfo<T extends keyof UserItemDbRecordMap> = {
	item: UserItemDbRecordMap[T]
	comments: UserItemCommentDbRecordMap[T][]
	usernames: Map<number,string>
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
	getItemKeyRange(uid: number, streamBoundary: StreamBoundary): IDBKeyRange|null {
		const lowerItemDate=this.lowerItemDate
		const upperItemDate=streamBoundary.getOwnOrLowerDate(this.upperItemDate)
		if (lowerItemDate.getTime()>upperItemDate.getTime()) return null
		return IDBKeyRange.bound(
			[uid,lowerItemDate],
			[uid,upperItemDate,+Infinity]
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

export interface SingleItemDBReader {
	getChangeset(id: number): Promise<ChangesetDbRecord|undefined>
	getNote(id: number): Promise<NoteDbRecord|undefined>
	getChangesetComment(changesetId: number, order: number): Promise<{
		comment?: ChangesetCommentDbRecord
		username?: string
	}>
	getNoteComment(noteId: number, order: number): Promise<{
		comment?: NoteCommentDbRecord
		username?: string
	}>
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
	getUserNames(uids: Iterable<number>): Promise<Map<number,string>> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction('users','readonly')
			tx.onerror=()=>reject(new Error(`Database error in getUserNames(): ${tx.error}`))
			const usernames=new Map<number,string>()
			tx.oncomplete=()=>resolve(usernames)
			const userStore=tx.objectStore('users')
			for (const uid of uids) {
				const request=userStore.get(uid)
				request.onsuccess=()=>{
					const user=request.result as UserDbRecord
					if (user==null || user.name==null) return
					usernames.set(uid,user.name)
				}
			}
		})
	}
	getUserItems<T extends keyof UserItemDbRecordMap>(
		type: T, uid: number, scan: UserScanDbRecord, streamBoundary: StreamBoundary, limit: number
	): Promise<[UserItemDbRecordMap[T],UserItemCommentDbRecordMap[T][]][]> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const commentsType=`${type.slice(0,-1)}Comments`
			const returnItems=(itemsWithComments:[UserItemDbRecordMap[T],UserItemCommentDbRecordMap[T][]][])=>{
				if (itemsWithComments.length==0) { // can also check if items.length<limit
					if (scan.endDate) {
						streamBoundary.finish()
					} else if (!scan.empty) {
						streamBoundary.advance(scan.lowerItemDate)
					}
				}
				return resolve(itemsWithComments)
			}
			if (scan.empty) {
				return returnItems([])
			}
			const scanBoundary=new ScanBoundary(scan)
			const range=scanBoundary.getItemKeyRange(uid,streamBoundary)
			if (!range) {
				return returnItems([])
			}
			const tx=this.idb.transaction([type,commentsType],'readonly')
			tx.onerror=()=>reject(new Error(`Database error in getUserItems(): ${tx.error}`))
			const itemsWithComments:[UserItemDbRecordMap[T],UserItemCommentDbRecordMap[T][]][]=[]
			tx.oncomplete=()=>returnItems(itemsWithComments)
			const itemCommentStore=tx.objectStore(commentsType)
			const itemCursorRequest=tx.objectStore(type).index('user').openCursor(range,'prev')
			let itemsCount=0
			itemCursorRequest.onsuccess=()=>{
				const cursor=itemCursorRequest.result
				if (!cursor) return
				const item=cursor.value as UserItemDbRecordMap[T]
				if (scanBoundary.isItemInside(item) && streamBoundary.visit(item.createdAt,item.id)) {
					itemsCount++
					const itemCommentsRequest=itemCommentStore.getAll(this.getItemCommentsRange(item))
					itemCommentsRequest.onsuccess=()=>{
						const comments=itemCommentsRequest.result as UserItemCommentDbRecordMap[T][]
						itemsWithComments.push([item,comments])
					}
				}
				if (itemsCount<limit) {
					cursor.continue()
				}
			}
		})
	}
	getSingleItemReader(): SingleItemDBReader {
		const makeItemReader=<T extends keyof UserItemDbRecordMap>(type:T,fnName:string)=>(id:number):Promise<UserItemDbRecordMap[T]>=>{
			if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
			return new Promise((resolve,reject)=>{
				const tx=this.idb.transaction(type,'readonly')
				tx.onerror=()=>reject(new Error(`Database error in SingleItemDBReader.${fnName}(): ${tx.error}`))
				const request=tx.objectStore(type).get(id)
				request.onsuccess=()=>{
					resolve(request.result)
				}
			})
		}
		const makeItemCommentReader=<T extends keyof UserItemDbRecordMap>(type:T,fnName:string)=>(itemId:number,order:number):Promise<{
			comment?: UserItemCommentDbRecordMap[T]
			username?: string
		}>=>{
			if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
			return new Promise((resolve,reject)=>{
				const commentsType=`${type.slice(0,-1)}Comments`
				const tx=this.idb.transaction([commentsType,'users'],'readonly')
				tx.onerror=()=>reject(new Error(`Database error in SingleItemDBReader.${fnName}(): ${tx.error}`))
				const commentRequest=tx.objectStore(commentsType).get([itemId,order])
				commentRequest.onsuccess=()=>{
					const comment=commentRequest.result as NoteCommentDbRecord
					if (!comment) return resolve({})
					if (comment.uid==null) return resolve({comment})
					const userRequest=tx.objectStore('users').get(comment.uid)
					userRequest.onsuccess=()=>{
						const user=userRequest.result as UserDbRecord
						if (!user || user.name==null) return resolve({comment})
						resolve({comment,username:user.name})
					}
				}
			})
		}
		return {
			getChangeset: makeItemReader('changesets','getChangeset'),
			getNote: makeItemReader('notes','getNote'),
			getChangesetComment: makeItemCommentReader('changesets','getChangesetComment'),
			getNoteComment: makeItemCommentReader('notes','getNoteComment')
		}
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
				const changesetCommentStore=idb.createObjectStore('changesetComments',{keyPath:['itemId','order']})
				changesetCommentStore.createIndex('user',['itemUid','createdAt','itemId','order'])
				const noteCommentStore=idb.createObjectStore('noteComments',{keyPath:['itemId','order']})
				noteCommentStore.createIndex('user',['itemUid','createdAt','itemId','order'])
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
	protected getItemCommentsRange(item: UserItemDbRecord): IDBKeyRange {
		return IDBKeyRange.bound([item.id],[item.id,+Infinity])
	}
}
