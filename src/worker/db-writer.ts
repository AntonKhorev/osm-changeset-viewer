import type {UserItemStreamResumeInfo} from './user-item-stream'
import type {UserDbRecord, UserScanDbRecord, UserItemDbRecordMap} from '../db'
import {ChangesetViewerDBReader} from '../db'

export class ChangesetViewerDBWriter extends ChangesetViewerDBReader {
	putUser(user: UserDbRecord): Promise<void> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction('users','readwrite')
			tx.onerror=()=>reject(new Error(`Database error in putUser(): ${tx.error}`))
			tx.objectStore('users').put(user).onsuccess=()=>resolve()
		})
	}
	getUserItemStreamResumeInfo<T extends keyof UserItemDbRecordMap>(type: T, uid: number): Promise<UserItemStreamResumeInfo|undefined> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction([type,'userScans'],'readonly')
			tx.onerror=()=>reject(new Error(`Database error in getUserStreamResumeInfo(): ${tx.error}`))
			const scanRequest=tx.objectStore('userScans').get([uid,0,type])
			scanRequest.onsuccess=()=>{
				if (scanRequest.result==null) {
					return resolve(undefined)
				}
				const scan=scanRequest.result as UserScanDbRecord
				if (scan.empty) {
					return resolve(undefined)
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
						resolve({lowerItemDate,itemIdsWithLowerDate})
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
	addUserItems<T extends keyof UserItemDbRecordMap>(
		type: T, uid: number, now: Date, items: UserItemDbRecordMap[T][], isEnded: boolean,
		mode: 'toNewScan'|'toExistingScan'|'toNewOrExistingScan'
	): Promise<boolean> {
		if (this.closed) throw new Error(`Database is outdated, please reload the page.`)
		return new Promise((resolve,reject)=>{
			const tx=this.idb.transaction([type,'userScans'],'readwrite')
			tx.onerror=()=>reject(new Error(`Database error in addUserItems(): ${tx.error}`))
			const handleScan=(scan: UserScanDbRecord)=>{
				for (const item of items) {
					tx.objectStore(type).put(item)
					if (scan.empty) {
						scan={
							...scan,
							empty: false,
							upperItemDate: item.createdAt,
							lowerItemDate: item.createdAt
						}
					} else {
						if (scan.upperItemDate.getTime()<item.createdAt.getTime()) {
							scan.upperItemDate=item.createdAt
						}
						if (scan.lowerItemDate.getTime()>item.createdAt.getTime()) {
							scan.lowerItemDate=item.createdAt
						}
					}
					scan.items.count++
				}
				if (isEnded) {
					scan.endDate=now
				} else {
					delete scan.endDate
				}
				tx.objectStore('userScans').put(scan)
				tx.oncomplete=()=>resolve(true)
			}
			const makeEmptyScan=():UserScanDbRecord=>({
				uid,
				type,
				stash: 0,
				items: {count:0},
				beginDate: now,
				empty: true
			})
			if (mode=='toNewScan') {
				handleScan(makeEmptyScan())
			} else {
				const getScanRequest=tx.objectStore('userScans').get([uid,0,type])
				getScanRequest.onsuccess=()=>{
					let scan: UserScanDbRecord
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
