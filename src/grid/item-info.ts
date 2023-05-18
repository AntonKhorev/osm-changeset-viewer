import type {MuxBatchItem} from '../mux-user-item-db-stream'

export type ItemDescriptor = {
	type: string
	id: number
	order?: number
}

export function readItemDescriptor($item: HTMLElement): ItemDescriptor|null {
	const type=$item.dataset.type
	if (!type) return null
	const id=Number($item.dataset.id)
	if (!Number.isInteger(id)) return null
	const orderString=$item.dataset.order
	if (orderString!=null) {
		const order=Number(orderString)
		if (!Number.isInteger(order)) return null
		if (order!=0) return {type,id,order}
	}
	return {type,id}
}

export function getItemDescriptorSelector({type,id,order}: ItemDescriptor): string {
	return `.item[data-type="${type}"][data-id="${id}"]`+(order
		? `[data-order="${order}"]`
		: `:not([data-order])`
	)
}

export type ItemSequenceInfo = { // TODO this is RowSequenceInfo, which includes separators, they don't have ids
	timestamp: number
	type: string
	id?: number
	order?: number
}

export function isGreaterItemSequenceInfo(a: ItemSequenceInfo, b: ItemSequenceInfo): boolean {
	if (a.timestamp!=b.timestamp) return a.timestamp>b.timestamp
	const aRank=getItemTypeRank(a.type)
	const bRank=getItemTypeRank(b.type)
	if (aRank!=bRank) return aRank>bRank
	if (a.id!=b.id) return (a.id??0)>(b.id??0)
	return (a.order??0)>(b.order??0)
}

function getItemTypeRank(type: ItemSequenceInfo['type']): number {
	// 0 = rank of separators // TODO why is it not returned?
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

export function getItemSequenceInfo({type,item}: MuxBatchItem): ItemSequenceInfo|null {
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

export function readItemSequenceInfo($item: HTMLElement): ItemSequenceInfo|null {
	const timestamp=Number($item.dataset.timestamp)
	if (timestamp==null) return null
	const type=$item.dataset.type
	if (!type) return null
	const idString=$item.dataset.id
	if (idString==null) return {timestamp,type}
	const id=Number(idString)
	if (!Number.isInteger(id)) return null
	const orderString=$item.dataset.order
	if (orderString==null) return {timestamp,type,id}
	const order=Number(orderString)
	if (!Number.isInteger(order)) return null
	if (order==0) return {timestamp,type,id}
	return {timestamp,type,id,order}
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
