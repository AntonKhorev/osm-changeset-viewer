import type {Server} from '../net'
import type {SingleItemDBReader} from '../db'
import type {ItemSequenceInfo} from './sequence'
import {
	isGreaterItemSequenceInfo, getItemSequenceInfo,
	readItemSequenceInfo, writeItemSequenceInfo, writeSeparatorSequenceInfo
} from './sequence'
import {
	getItemCheckbox, getItemDisclosureButton,
	markChangesetItemAsCombined, markChangesetItemAsUncombined,
	makeItemShell, writeCollapsedItemFlow, writeExpandedItemFlow
} from './body-item'
import type {GridBatchItem} from '../mux-user-item-db-stream-messenger'
import {toIsoYearMonthString} from '../date'
import {makeElement, makeDiv} from '../util/html'
import {moveInArray} from '../util/types'

type CellTimelineRelation = {
	withTimelineAbove: boolean
	withTimelineBelow: boolean
}

type GridPosition = {
	type: 'afterRow'
	$row: HTMLTableRowElement
} | {
	type: 'insideRow'
	$row: HTMLTableRowElement
	$items: (HTMLElement|null)[]
}

export default class GridBody {
	readonly $gridBody=makeElement('tbody')()()
	onItemSelect: ()=>void = ()=>{}
	private readonly wrappedItemSelectListener: ()=>void
	private readonly wrappedItemDisclosureButtonListener: (ev:Event)=>void
	private $timelineCutoffRows: (HTMLTableRowElement|null)[] = []
	constructor(
		private readonly server: Server,
		private readonly itemReader: SingleItemDBReader
	) {
		this.wrappedItemSelectListener=()=>this.onItemSelect()
		this.wrappedItemDisclosureButtonListener=(ev:Event)=>this.toggleItemDisclosure(ev.currentTarget)
	}
	get nColumns(): number {
		return this.$timelineCutoffRows.length
	}
	setColumns(nColumns: number): void {
		this.$timelineCutoffRows=new Array(nColumns).fill(null)
		this.$gridBody.replaceChildren()
	}
	addItem(
		columnHues: (number|null)[],
		batchItem: GridBatchItem,
		usernames: Map<number, string>,
		isCollapsed: boolean
	): boolean {
		const [$masterPlaceholder,classNames]=makeItemShell(batchItem)
		const $placeholders=batchItem.iColumns.map(()=>$masterPlaceholder.cloneNode(true) as HTMLElement)
		return this.insertItem(columnHues,batchItem,usernames,isCollapsed,$placeholders,classNames)
	}
	updateTableAccordingToSettings(inOneColumn: boolean, withClosedChangesets: boolean): void {
		const combineChangesets=($item: HTMLElement, $laterItem: HTMLElement|undefined)=>{
			const isConnectedWithLaterItem=(
				$laterItem &&
				$laterItem.classList.contains('changeset') &&
				$laterItem.classList.contains('closed') &&
				$item.dataset.id==$laterItem.dataset.id
			)
			if ($item.classList.contains('changeset')) {
				if ($item.classList.contains('closed')) {
					$item.classList.toggle('hidden-as-closed',!withClosedChangesets)
				} else {
					if (isConnectedWithLaterItem || !withClosedChangesets) {
						if ($laterItem && isConnectedWithLaterItem) {
							$laterItem.classList.add('hidden-as-closed')
						}
						markChangesetItemAsCombined($item,$item.dataset.id??'???')
					} else {
						markChangesetItemAsUncombined($item,$item.dataset.id??'???')
					}
				}
			}
		}
		const spanColumns=($row:HTMLTableRowElement)=>{
			let spanned=false
			for (const $cell of $row.cells) {
				if (inOneColumn) {
					if (!spanned && $cell.childNodes.length) {
						$cell.hidden=false
						$cell.colSpan=this.nColumns+1
						spanned=true
					} else {
						$cell.hidden=true
						$cell.removeAttribute('colspan')
					}
				} else {
					$cell.hidden=false
					$cell.removeAttribute('colspan')
				}
			}
		}
		let $itemRowAbove: HTMLElement|undefined
		for (const $row of this.$gridBody.rows) {
			if ($row.classList.contains('collection')) {
				for (const $cell of $row.cells) {
					let $laterItem: HTMLElement|undefined
					for (const $item of $cell.querySelectorAll(':scope > .item')) {
						if (!($item instanceof HTMLElement)) continue
						combineChangesets($item,$laterItem)
						$laterItem=$item
					}
				}
				// spanColumns($row) // TODO need to merge/split collected items in cells
				$itemRowAbove=undefined
			} else if ($row.classList.contains('item')) {
				combineChangesets($row,$itemRowAbove)
				spanColumns($row)
				$itemRowAbove=$row
			} else {
				$itemRowAbove=undefined
			}
		}
	}
	reorderColumns(iShiftFrom: number, iShiftTo: number): void {
		moveInArray(this.$timelineCutoffRows,iShiftFrom,iShiftTo)
		for (const $row of this.$gridBody.rows) {
			if (!$row.classList.contains('item')) continue
			const $cells=[...$row.cells]
			moveInArray($cells,iShiftFrom,iShiftTo)
			$row.replaceChildren(...$cells)
		}
	}
	getColumnCheckboxStatuses(): [
		hasChecked: boolean[],
		hasUnchecked: boolean[]
	] {
		const hasChecked=this.$timelineCutoffRows.map(()=>false)
		const hasUnchecked=this.$timelineCutoffRows.map(()=>false)
		for (const $row of this.$gridBody.rows) {
			if (!$row.classList.contains('collection') && !$row.classList.contains('changeset')) continue
			for (const [iColumn,$cell] of [...$row.cells].entries()) {
				for (const $checkbox of listCellCheckboxes($cell,$row.classList.contains('collection'))) {
					hasChecked[iColumn]||=$checkbox.checked
					hasUnchecked[iColumn]||=!$checkbox.checked
				}
			}
		}
		return [hasChecked,hasUnchecked]
	}
	triggerColumnCheckboxes(iColumn: number, isChecked: boolean): void {
		for (const $row of this.$gridBody.rows) {
			if (!$row.classList.contains('collection') && !$row.classList.contains('changeset')) continue
			const $cell=$row.cells[iColumn]
			if (!$cell) continue
			for (const $checkbox of listCellCheckboxes($cell,$row.classList.contains('collection'))) {
				$checkbox.checked=isChecked
				syncColumnCheckboxes($checkbox)
			}
		}
		this.onItemSelect()
	}
	private insertItem(
		columnHues: (number|null)[],
		batchItem: GridBatchItem,
		usernames: Map<number, string>,
		isCollapsed: boolean,
		$previousPlaceholders: HTMLElement[],
		classNames: string[]
	): boolean {
		if (batchItem.iColumns.length==0) return false
		const sequenceInfo=getItemSequenceInfo(batchItem)
		if (!sequenceInfo) return false
		const $placeholders=this.insertItemPlaceholders(columnHues,batchItem.iColumns,sequenceInfo,isCollapsed,$previousPlaceholders,classNames)
		const $checkboxes:HTMLInputElement[]=[]
		for (const $placeholder of $placeholders) {
			const $flow=$placeholder.querySelector('.flow')
			if (!($flow instanceof HTMLElement)) continue
			if (isCollapsed) {
				const id=(batchItem.type=='changesetComment' || batchItem.type=='noteComment'
					? batchItem.item.itemId
					: batchItem.item.id
				)
				writeCollapsedItemFlow($flow,this.server,batchItem.type,id)
			} else {
				writeExpandedItemFlow($flow,this.server,batchItem,usernames)
			}
			const $checkbox=getItemCheckbox($placeholder)
			if ($checkbox) $checkboxes.push($checkbox)
			const $disclosureButton=getItemDisclosureButton($placeholder)
			$disclosureButton?.addEventListener('click',this.wrappedItemDisclosureButtonListener)
		}
		for (const $checkbox of $checkboxes) {
			if ($checkboxes.length>1) {
				$checkbox.addEventListener('input',columnCheckboxSyncListener)
			}
			$checkbox.addEventListener('input',this.wrappedItemSelectListener)
		}
		return true
	}
	private insertItemPlaceholders(
		columnHues: (number|null)[],
		iColumns: number[],
		sequenceInfo: ItemSequenceInfo,
		isCollapsed: boolean,
		$previousPlaceholders: HTMLElement[],
		classNames: string[]
	): HTMLElement[] {
		const cellTimelineRelations:CellTimelineRelation[]=this.$timelineCutoffRows.map($timelineCutoffRow=>({
			withTimelineAbove: $timelineCutoffRow==null,
			withTimelineBelow: $timelineCutoffRow==null,
		}))
		let position=this.getGridPositionAndInsertSeparatorIfNeeded(sequenceInfo)
		let $row:HTMLTableRowElement
		let isNewRow:boolean
		if (isCollapsed && position.type=='insideRow') {
			$row=position.$row
			isNewRow=false
		} else {
			$row=this.insertRow(position)
			isNewRow=true
		}
		if (sequenceInfo.type=='user') {
			const iColumnSet=new Set(iColumns)
			for (const iColumn of iColumns) {
				this.$timelineCutoffRows[iColumn]=$row
				cellTimelineRelations[iColumn].withTimelineBelow=false
			}
			for (let $followingRow=$row.nextElementSibling;$followingRow;$followingRow=$followingRow.nextElementSibling) {
				if (!($followingRow instanceof HTMLTableRowElement)) continue
				if (!$followingRow.classList.contains('item')) continue
				for (const [iColumn,$cell] of [...$followingRow.cells].entries()) {
					if (!iColumnSet.has(iColumn)) continue
					$cell.classList.remove('with-timeline-above','with-timeline-below')
				}
			}
		}
		if (isNewRow) {
			for (const [iColumn,cellTimelineRelation] of cellTimelineRelations.entries()) {
				const $cell=$row.insertCell()
				$cell.classList.toggle('with-timeline-above',cellTimelineRelation.withTimelineAbove)
				$cell.classList.toggle('with-timeline-below',cellTimelineRelation.withTimelineBelow)
				const hue=columnHues[iColumn]
				if (hue!=null) {
					$cell.style.setProperty('--hue',String(hue))
				}
			}
		}
		const copyPlaceholderChildren=($placeholder:HTMLElement,iPlaceholder:number)=>{
			$placeholder.replaceChildren(
				...$previousPlaceholders[iPlaceholder].childNodes
			)
		}
		if (isCollapsed) {
			$row.classList.add('collection')
			const $placeholders:HTMLElement[]=[]
			for (const [iPlaceholder,iColumn] of iColumns.entries()) {
				const $placeholder=makeElement('span')(...classNames)()
				writeItemSequenceInfo($placeholder,sequenceInfo)
				copyPlaceholderChildren($placeholder,iPlaceholder)
				const $cell=$row.cells[iColumn]
				if (position.type=='insideRow') {
					const $precedingItem=position.$items[iColumn]
					if ($precedingItem==null) {
						$cell.prepend($placeholder)
					} else {
						$precedingItem.after($placeholder)
					}
				} else {
					$cell.append($placeholder)
				}
				$placeholders.push($placeholder)
			}
			return $placeholders
		} else {
			$row.classList.add(...classNames)
			writeItemSequenceInfo($row,sequenceInfo)
			return iColumns.map((iColumn,iPlaceholder)=>{
				const $placeholder=$row.cells[iColumn]
				copyPlaceholderChildren($placeholder,iPlaceholder)
				return $placeholder
			})
		}
	}
	private getGridPositionAndInsertSeparatorIfNeeded(sequenceInfo: ItemSequenceInfo): GridPosition {
		const insertSeparatorRow=($precedingRow?:HTMLTableRowElement)=>{
			const date=new Date(sequenceInfo.timestamp)
			const yearMonthString=toIsoYearMonthString(date)
			const $separator=makeElement('tr')('separator')()
			if ($precedingRow) {
				$precedingRow.after($separator)
			} else {
				this.$gridBody.prepend($separator)
			}
			writeSeparatorSequenceInfo($separator,date)
			const $cell=$separator.insertCell()
			$cell.append(
				makeDiv('month')(
					makeElement('time')()(yearMonthString)
				)
			)
			$cell.colSpan=this.nColumns+1
			return $separator
		}
		let $followingSameMonthCollectionRow:HTMLTableRowElement|undefined
		for (let i=this.$gridBody.rows.length-1;i>=0;i--) {
			const $row=this.$gridBody.rows[i]
			if ($row.classList.contains('collection')) {
				let isSameMonthRow=true
				const $items=[...$row.cells].map(($cell:HTMLTableCellElement)=>{
					const $items=$cell.querySelectorAll(':scope > .item')
					for (let i=$items.length-1;i>=0;i--) {
						const $item=$items[i]
						if (!($item instanceof HTMLElement)) continue
						const precedingSequenceInfo=readItemSequenceInfo($item)
						if (!isSameMonthTimestamps(precedingSequenceInfo.timestamp,sequenceInfo.timestamp)) {
							isSameMonthRow=false
						}
						if (isGreaterItemSequenceInfo(precedingSequenceInfo,sequenceInfo)) {
							return $item
						}
					}
					return null
				})
				if ($items.some($item=>$item!=null)) {
					if (isSameMonthRow) {
						return {
							type: 'insideRow',
							$row,
							$items
						}
					} else {
						return {
							type: 'afterRow',
							$row: insertSeparatorRow($row)
						}
					}
				} else {
					if (isSameMonthRow) {
						$followingSameMonthCollectionRow=$row
					} else {
						$followingSameMonthCollectionRow=undefined
					}
				}
			} else {
				const precedingSequenceInfo=readItemSequenceInfo($row)
				if (isGreaterItemSequenceInfo(precedingSequenceInfo,sequenceInfo)) {
					if (!isSameMonthTimestamps(precedingSequenceInfo.timestamp,sequenceInfo.timestamp)) {
						return {
							type: 'afterRow',
							$row: insertSeparatorRow($row)
						}
					} else if ($followingSameMonthCollectionRow) {
						return {
							type: 'insideRow',
							$row: $followingSameMonthCollectionRow,
							$items: [...$followingSameMonthCollectionRow.cells].map(_=>null)
						}
					} else {
						return {
							type: 'afterRow',
							$row
						}
					}
				} else {
					$followingSameMonthCollectionRow=undefined
				}
			}
		}
		return {
			type: 'afterRow',
			$row: insertSeparatorRow()
		}
	}
	private insertRow(position: GridPosition): HTMLTableRowElement {
		const $row=makeElement('tr')()()
		if (position.type=='afterRow') {
			position.$row.after($row)
		} else if (position.type=='insideRow') {
			if (position.$items.every($item=>$item==null)) {
				position.$row.before($row)
			} else {
				position.$row.after($row)
				const $cellChildrenAfterInColumns=position.$items.map($precedingItem=>{
					if (!$precedingItem) return []
					const $cellChildrenAfter:Element[]=[]
					let $child:Element|null=$precedingItem
					while ($child=$child?.nextElementSibling) {
						$cellChildrenAfter.push($child)
					}
					return $cellChildrenAfter
				})
				if ($cellChildrenAfterInColumns.some($cellChildrenAfter=>$cellChildrenAfter.length>0)) {
					const $rowAfter=makeElement('tr')('collection')()
					for (const $cellChildrenAfter of $cellChildrenAfterInColumns) {
						$rowAfter.insertCell().append(...$cellChildrenAfter)
					}
					$row.after($rowAfter)
				}
			}
		}
		return $row
	}
	private async toggleItemDisclosure($disclosureButton: EventTarget|null): Promise<void> {
		if (!($disclosureButton instanceof HTMLButtonElement)) return
		const $item=$disclosureButton.closest('.item')
		if (!($item instanceof HTMLElement)) return
		const sequenceInfo=readItemSequenceInfo($item)
		const $itemRow=$item.closest('tr')
		if (!$itemRow) return
		const $itemCopies=listItemCopies($itemRow,sequenceInfo.type,sequenceInfo.id)
		if (sequenceInfo.type=='changeset' || sequenceInfo.type=='changesetClose') {
			const changeset=await this.itemReader.getChangeset(sequenceInfo.id)
			console.log('TODO disclose changeset',changeset,'for items',$itemCopies)
		} else if (sequenceInfo.type=='note') {
			const note=await this.itemReader.getNote(sequenceInfo.id)
			console.log('TODO disclose note',note,'for items',$itemCopies)
		} else if (sequenceInfo.type=='changesetComment') {
			const {comment,username}=await this.itemReader.getChangesetComment(sequenceInfo.id,sequenceInfo.order)
			console.log('TODO disclose changeset comment',comment,'by',username,'for items',$itemCopies)
		} else if (sequenceInfo.type=='noteComment') {
			const {comment,username}=await this.itemReader.getNoteComment(sequenceInfo.id,sequenceInfo.order)
			console.log('TODO disclose note comment',comment,'by',username,'for items',$itemCopies)
		}
	}
}

function columnCheckboxSyncListener(this: HTMLInputElement): void {
	syncColumnCheckboxes(this)
}

function *listCellCheckboxes($cell: HTMLTableCellElement, isCollection: boolean): Iterable<HTMLInputElement> {
	if (isCollection) {
		for (const $changeset of $cell.querySelectorAll(':scope > .changeset')) {
			if (!($changeset instanceof HTMLElement)) continue
			const $checkbox=getItemCheckbox($changeset)
			if ($checkbox) yield $checkbox
		}
	} else {
		const $checkbox=getItemCheckbox($cell)
		if ($checkbox) yield $checkbox
	}
}

function syncColumnCheckboxes($checkbox: HTMLInputElement): void {
	const $itemRow=$checkbox.closest('tr')
	if (!$itemRow) return
	const $item=$checkbox.closest('.item')
	if (!($item instanceof HTMLElement)) return
	const sequenceInfo=readItemSequenceInfo($item)
	for (const [$itemCopy] of listItemCopies($itemRow,sequenceInfo.type,sequenceInfo.id)) {
		const $checkboxCopy=getItemCheckbox($itemCopy)
		if (!$checkboxCopy) continue
		$checkboxCopy.checked=$checkbox.checked
	}
}

function listItemCopies($itemRow: HTMLTableRowElement, type: string, id: number): [$item:HTMLElement, iColumn:number][] {
	if ($itemRow.classList.contains('item')) {
		return [...$itemRow.cells].flatMap(($cell,iColumn):[$item:HTMLElement,iColumn:number][]=>{
			if ($cell.hasChildNodes()) {
				return [[$cell,iColumn]]
			} else {
				return []
			}
		})
	} else if ($itemRow.classList.contains('collection')) {
		return [...$itemRow.cells].flatMap(($cell,iColumn):[$item:HTMLElement,iColumn:number][]=>{
			return [...$cell.querySelectorAll(`.item[data-type="${type}"][data-id="${id}"]`)].map($item=>[$item as HTMLElement,iColumn])
		})
	} else {
		return []
	}
}

function isSameMonthTimestamps(t1: number, t2: number): boolean {
	const d1=new Date(t1)
	const d2=new Date(t2)
	return d1.getUTCFullYear()==d2.getFullYear() && d1.getUTCMonth()==d2.getUTCMonth()
}
