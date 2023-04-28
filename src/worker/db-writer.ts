import type {UserDbRecord, UserScanDbRecord, UserItemDbRecordMap} from '../db'
import {ChangesetViewerDBReader} from '../db'
import StreamBoundary from '../stream-boundary'

export class ChangesetViewerDBWriter extends ChangesetViewerDBReader {
	putUser(user: UserDbRecord): Promise<void> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction('users','readwrite')
			tx.onerror=()=>reject(new Error(`Database error in putUser(): ${tx.error}`))
			tx.objectStore('users').put(user).onsuccess=()=>resolve()
		})
	}
	getUserItemStreamBoundary<T extends keyof UserItemDbRecordMap>(type: T, uid: number): Promise<StreamBoundary> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction([type,'userScans'],'readonly')
			tx.onerror=()=>reject(new Error(`Database error in getUserStreamResumeInfo(): ${tx.error}`))
			const scanRequest=tx.objectStore('userScans').get([uid,0,type])
			scanRequest.onsuccess=()=>{
				if (scanRequest.result==null) {
					return resolve(new StreamBoundary())
				}
				const scan=scanRequest.result as UserScanDbRecord
				if (scan.empty) {
					return resolve(new StreamBoundary())
				}
				const itemRequest=tx.objectStore(type).index('user').getAll(
					IDBKeyRange.bound([uid,scan.lowerItemDate],[uid,scan.lowerItemDate,+Infinity])
				)
				itemRequest.onsuccess=()=>{
					let lowerItemDate: Date|undefined
					const itemIdsWithLowerDate=itemRequest.result.map((item:UserItemDbRecordMap[T])=>{
						if (!lowerItemDate || lowerItemDate.getTime()>item.createdAt.getTime()) {
							lowerItemDate=item.createdAt
						}
						return item.id
					})
					if (lowerItemDate) {
						resolve(new StreamBoundary({
							date: lowerItemDate,
							visitedIds: itemIdsWithLowerDate
						}))
					} else {
						resolve(new StreamBoundary())
					}
				}
			}
		})
	}
	/**
	 * Store items if they were acquired as a side effect of some other operation, like changesets when getting user info
	 *
	 * @returns true if decided to add/update the scan
	 */
	addUserItemsIfNoScan<T extends keyof UserItemDbRecordMap>(
		type: T, uid: number, now: Date, items: UserItemDbRecordMap[T][], streamBoundary: StreamBoundary
	): Promise<boolean> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction([type,'userScans'],'readwrite')
			tx.onerror=()=>reject(new Error(`Database error in addUserItemsIfNoScan(): ${tx.error}`))
			const handleScan=(scan: UserScanDbRecord)=>{
				const updatedScan=this.addUserItemsToScan(
					now,items,streamBoundary,
					tx.objectStore(type),scan
				)
				tx.objectStore('userScans').put(updatedScan)
			}
			const getScanRequest=tx.objectStore('userScans').get([uid,0,type])
			getScanRequest.onsuccess=()=>{
				if (getScanRequest.result==null) {
					handleScan(makeEmptyScan(uid,type,now))
					tx.oncomplete=()=>resolve(true)
				} else {
					resolve(false)
				}
			}
		})
	}
	addUserItems<T extends keyof UserItemDbRecordMap>(
		type: T, uid: number, now: Date, items: UserItemDbRecordMap[T][], streamBoundary: StreamBoundary,
		forceNewScan: boolean
	): Promise<void> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction([type,'userScans'],'readwrite')
			tx.onerror=()=>reject(new Error(`Database error in addUserItemsIfNoScan(): ${tx.error}`))
			tx.oncomplete=()=>resolve()
			const handleScan=(scan: UserScanDbRecord)=>{
				const updatedScan=this.addUserItemsToScan(
					now,items,streamBoundary,
					tx.objectStore(type),scan
				)
				tx.objectStore('userScans').put(updatedScan)
			}
			if (forceNewScan) {
				handleScan(makeEmptyScan(uid,type,now))
			} else {
				const getScanRequest=tx.objectStore('userScans').get([uid,0,type])
				getScanRequest.onsuccess=()=>{
					if (getScanRequest.result==null) {
						handleScan(makeEmptyScan(uid,type,now))
					} else {
						handleScan(getScanRequest.result)
					}
				}
			}
		})
	}
	private addUserItemsToScan<T extends keyof UserItemDbRecordMap>(
		now: Date, items: UserItemDbRecordMap[T][], streamBoundary: StreamBoundary,
		store: IDBObjectStore, scan: UserScanDbRecord
	): UserScanDbRecord {
		for (const item of items) {
			store.put(item)
			scan=addUserItemIdsAndDateToScan(scan,item.createdAt,[item.id])
		}
		if (streamBoundary.date) {
			scan=addUserItemIdsAndDateToScan(scan,streamBoundary.date,[])
		}
		if (streamBoundary.isFinished) {
			scan.endDate=now
		} else {
			delete scan.endDate
		}
		return scan
	}
	static open(host: string): Promise<ChangesetViewerDBWriter> {
		return this.openWithType(host,idb=>new ChangesetViewerDBWriter(idb))
	}
}

function makeEmptyScan(uid: number, type: keyof UserItemDbRecordMap, beginDate: Date): UserScanDbRecord {
	return {
		uid,
		type,
		stash: 0,
		items: {count:0},
		beginDate,
		empty: true
	}
}

function addUserItemIdsAndDateToScan(scan: UserScanDbRecord, itemDate: Date, itemIds: number[]): UserScanDbRecord {
	if (scan.empty) {
		scan={
			...scan,
			empty: false,
			upperItemDate: itemDate,
			upperItemIds: [...itemIds],
			lowerItemDate: itemDate,
			lowerItemIds: [...itemIds],
		}
	} else {
		if (scan.upperItemDate.getTime()<itemDate.getTime()) {
			scan={
				...scan,
				upperItemDate: itemDate,
				upperItemIds: [...itemIds],
			}
		} else if (scan.upperItemDate.getTime()==itemDate.getTime()) {
			scan={
				...scan,
				upperItemIds: [...itemIds,...scan.upperItemIds],
			}
		}
		if (scan.lowerItemDate.getTime()>itemDate.getTime()) {
			scan={
				...scan,
				lowerItemDate: itemDate,
				lowerItemIds: [...itemIds],
			}
		} else if (scan.lowerItemDate.getTime()==itemDate.getTime()) {
			scan={
				...scan,
				lowerItemIds: [...itemIds,...scan.lowerItemIds],
			}
		}
	}
	if (itemIds.length>0) {
		scan={
			...scan,
			items: {
				count: scan.items.count+itemIds.length
			}
		}
	}
	return scan
}
