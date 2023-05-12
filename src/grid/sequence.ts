import type {GridBatchItem} from '../mux-user-item-db-stream-messenger'

export type ItemSequenceInfo = {
	timestamp: number
	// rank: number
	// type: MuxBatchItem['type'] | 'separator'
	type: string,
	id: number
	order: number
}

export function isGreaterItemSequenceInfo(a: ItemSequenceInfo, b: ItemSequenceInfo): boolean {
	if (a.timestamp>b.timestamp) return true
	// if (a.rank>b.rank) return true
	if (getItemTypeRank(a.type)>getItemTypeRank(b.type)) return true
	if (a.id>b.id) return true
	return a.order>b.order
}

function getItemTypeRank(type: ItemSequenceInfo['type']): number {
	// 0 = rank of separators
	switch (type) {
	case 'user':
		return 1
	case 'changeset':
		return 2
	case 'changesetClose':
		return 3
	case 'note':
		return 4
	case 'changesetComment':
		return 5
	case 'noteComment':
		return 6
	}
	return +Infinity
}

export function getItemSequenceInfo({type,item}: GridBatchItem): ItemSequenceInfo|null {
	let date: Date
	let id: number
	let order=0
	if (type=='user') {
		date=item.createdAt
		id=item.id
	} else if (type=='changeset' || type=='changesetClose') {
		date=item.createdAt
		if (type=='changesetClose' && item.closedAt) {
			date=item.closedAt
		}
		id=item.id
	} else if (type=='note') {
		date=item.createdAt
		id=item.id
	} else if (type=='changesetComment' || type=='noteComment') {
		date=item.createdAt
		id=item.itemId
		order=item.order
	} else {
		return null
	}
	return {
		timestamp: date.getTime(),
		// rank: getItemTypeRank(type),
		type,
		id,
		order
	}
}

export function readItemSequenceInfo($e: HTMLElement): ItemSequenceInfo {
	return {
		timestamp: Number($e.dataset.timestamp),
		// rank: Number($e.dataset.rank),
		type: $e.dataset.type??'',
		id: Number($e.dataset.id??'0'),
		order: Number($e.dataset.order??'0')
	}
}

export function writeItemSequenceInfo($e: HTMLElement, info: ItemSequenceInfo): void {
	$e.dataset.timestamp=String(info.timestamp)
	// $e.dataset.rank=String(info.rank)
	$e.dataset.type=info.type
	if (info.id) {
		$e.dataset.id=String(info.id)
	} else {
		delete $e.dataset.id
	}
	if (info.order) {
		$e.dataset.order=String(info.order)
	} else {
		delete $e.dataset.order
	}
}

export function writeSeparatorSequenceInfo($e: HTMLElement, date: Date): void {
	writeItemSequenceInfo($e,{
		timestamp: getLastTimestampOfMonth(date),
		type: 'separator',
		id: 0,
		order: 0
	})
}

function getLastTimestampOfMonth(date: Date): number {
	let monthIndex=date.getUTCMonth()
	let year=date.getUTCFullYear()
	monthIndex++
	if (monthIndex>=12) {
		monthIndex=0
		year++
	}
	return Date.UTC(year,monthIndex)-1
}
