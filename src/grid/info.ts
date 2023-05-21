import type {MuxBatchItem} from '../mux-user-item-db-stream'

export type ItemDescriptor = {
	type: string
	id: number
	order?: number
}

export type ElementSequencePoint = {
	timestamp: number
	type: string
	id?: number
	order?: number
}

export type ItemSequencePoint = {
	timestamp: number
	type: string
	id: number
	order?: number
}

export function getItemDescriptorSelector({type,id,order}: ItemDescriptor): string {
	return `.item[data-type="${type}"][data-id="${id}"]`+(order
		? `[data-order="${order}"]`
		: `:not([data-order])`
	)
}

export function isGreaterElementSequencePoint(a: ElementSequencePoint, b: ElementSequencePoint): boolean {
	if (a.timestamp!=b.timestamp) return a.timestamp>b.timestamp
	const aRank=getElementTypeRank(a.type)
	const bRank=getElementTypeRank(b.type)
	if (aRank!=bRank) return aRank>bRank
	if (a.id!=b.id) return (a.id??0)>(b.id??0)
	return (a.order??0)>(b.order??0)
}

export function isEqualItemDescriptor(a: ItemDescriptor, b: ItemDescriptor): boolean {
	return a.type==b.type && a.id==b.id && a.order==b.order
}

function getElementTypeRank(type: ElementSequencePoint['type']): number {
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
	return +Infinity // rank of separators
}

export function getBatchItemSequencePoint({type,item}: MuxBatchItem): ItemSequencePoint|null {
	let date: Date
	let id: number
	let order: number|undefined
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
	const timestamp=date.getTime()
	if (order) {
		return {timestamp,type,id,order}
	} else {
		return {timestamp,type,id}
	}
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

export function readElementSequencePoint($e: HTMLElement): ElementSequencePoint|null {
	const timestamp=Number($e.dataset.timestamp)
	if (timestamp==null) return null
	const type=$e.dataset.type
	if (!type) return null
	const idString=$e.dataset.id
	if (idString==null) return {timestamp,type}
	const id=Number(idString)
	if (!Number.isInteger(id)) return null
	const orderString=$e.dataset.order
	if (orderString==null) return {timestamp,type,id}
	const order=Number(orderString)
	if (!Number.isInteger(order)) return null
	if (order==0) return {timestamp,type,id}
	return {timestamp,type,id,order}
}

export function readItemSequencePoint($e: HTMLElement): ItemSequencePoint|null {
	const sequencePoint=readElementSequencePoint($e)
	if (!sequencePoint || sequencePoint.id==null) return null
	return sequencePoint as ItemSequencePoint
}

export function writeElementSequencePoint($e: HTMLElement, info: ElementSequencePoint): void {
	$e.dataset.timestamp=String(info.timestamp)
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

export function writeSeparatorSequencePoint($e: HTMLElement, date: Date): void {
	writeElementSequencePoint($e,{
		timestamp: getLastTimestampOfMonth(date),
		type: 'separator',
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