import {readItemDescriptor} from './info'
import {getItemCheckbox} from './body-item'

export default class GridBodyCheckboxHandler {
	onItemSelect: ()=>void = ()=>{}
	private $lastClickedCheckbox: HTMLInputElement|undefined
	private readonly wrappedClickListener: (this: HTMLElement, ev: MouseEvent)=>void
	constructor(private $gridBody: HTMLTableSectionElement) {
		const self=this
		this.wrappedClickListener=function(ev: MouseEvent){
			if (!(this instanceof HTMLInputElement)) return
			self.clickListener(this,ev.shiftKey)
		}
	}
	resetLastClickedCheckbox(): void {
		this.$lastClickedCheckbox=undefined
	}
	listen($checkbox: HTMLElement): void {
		$checkbox.addEventListener('click',this.wrappedClickListener)
	}
	triggerColumnCheckboxes(iColumn: number, isChecked: boolean): void {
		for (const $row of this.$gridBody.rows) {
			const targetChangesetIds=new Set<number>()
			for (const [,changesetId] of listRowCellCheckboxes($row,iColumn)) {
				targetChangesetIds.add(changesetId)
			}
			for (const [$checkbox,changesetId] of listRowCheckboxes($row)) {
				if (!targetChangesetIds.has(changesetId)) continue
				$checkbox.checked=isChecked
			}
		}
		this.onItemSelect()
	}
	getColumnCheckboxStatuses(nColumns: number): [
		hasChecked: boolean[],
		hasUnchecked: boolean[],
		selectedChangesetIds: Set<number>[]
	] {
		const hasChecked=Array<boolean>(nColumns).fill(false)
		const hasUnchecked=Array<boolean>(nColumns).fill(false)
		const selectedChangesetIds:Set<number>[]=[]
		for (let i=0;i<nColumns;i++) {
			selectedChangesetIds.push(new Set())
		}
		for (const $row of this.$gridBody.rows) {
			for (const [$checkbox,changesetId,iColumn] of listRowCheckboxes($row)) {
				hasChecked[iColumn]||=$checkbox.checked
				hasUnchecked[iColumn]||=!$checkbox.checked
				if ($checkbox.checked) {
					selectedChangesetIds[iColumn].add(changesetId)
				}
			}
		}
		return [hasChecked,hasUnchecked,selectedChangesetIds]
	}
	private clickListener($clickedCheckbox: HTMLInputElement, shiftKey: boolean): void {
		const getRowsAndChangesetIdsOfClickedCheckbox=()=>{
			const $row=$clickedCheckbox.closest('tr')
			const $item=$clickedCheckbox.closest('.item')
			if (!$row || !($item instanceof HTMLElement)) return null
			const descriptor=readItemDescriptor($item)
			if (!descriptor) return null
			return [[$row,new Set([descriptor.id])] as [$row: HTMLTableRowElement, changesetIds: Set<number>]]
		}
		let rowsAndChangesetIds: [$row: HTMLTableRowElement, changesetIds: Set<number>][] | null = null
		if (shiftKey && this.$lastClickedCheckbox) {
			rowsAndChangesetIds=this.getRowsAndChangesetIdsBetweenEdgeCheckboxes(this.$lastClickedCheckbox,$clickedCheckbox)
		}
		this.$lastClickedCheckbox=$clickedCheckbox
		if (!rowsAndChangesetIds) {
			rowsAndChangesetIds=getRowsAndChangesetIdsOfClickedCheckbox()
		}
		if (!rowsAndChangesetIds) return
		const isChecked=$clickedCheckbox.checked
		for (const [$row,changesetIds] of rowsAndChangesetIds) {
			for (const [$checkbox,changesetId] of listRowCheckboxes($row)) {
				if (!changesetIds.has(changesetId)) continue
				$checkbox.checked=isChecked
			}
		}
		this.onItemSelect()
	}
	private getRowsAndChangesetIdsBetweenEdgeCheckboxes(
		$checkbox1: HTMLInputElement, $checkbox2: HTMLInputElement
	): [$row: HTMLTableRowElement, changesetIds: Set<number>][] | null {
		const iColumn1=getElementColumn($checkbox1)
		const iColumn2=getElementColumn($checkbox2)
		if (iColumn1==null || iColumn2==null || iColumn1!=iColumn2) return null
		const rowsAndChangesetIds:[$row: HTMLTableRowElement, changesetIds: Set<number>][]=[]
		let insideRange=-1
		const $edgeCheckboxes=[$checkbox1,$checkbox2]
		const testEdgeCheckboxes=($checkbox: HTMLInputElement)=>{
			const i=$edgeCheckboxes.indexOf($checkbox)
			if (i<0) return false
			$edgeCheckboxes.splice(i,1)
			return true
		}
		for (const $row of this.$gridBody.rows) {
			const changesetIds=new Set<number>()
			for (const [$checkbox,changesetId] of listRowCellCheckboxes($row,iColumn1)) {
				if (insideRange<0 && testEdgeCheckboxes($checkbox)) insideRange++
				if (insideRange==0) changesetIds.add(changesetId)
				if (insideRange==0 && testEdgeCheckboxes($checkbox)) insideRange++
				if (insideRange>0) break
			}
			rowsAndChangesetIds.push([$row,changesetIds])
			if (insideRange>0) break
		}
		if (insideRange<=0) return null
		return rowsAndChangesetIds
	}
}

function getElementColumn($e: HTMLElement): number|null {
	const $row=$e.closest('tr')
	const $cell=$e.closest('td')
	if (!$row || !$cell) return null
	const iColumn=[...$row.cells].indexOf($cell)
	if (iColumn<0) return null
	return iColumn
}

function *listRowCheckboxes($row: HTMLTableRowElement, columnFilter: (iColumn:number)=>boolean = ()=>true): Iterable<[
	$checkbox: HTMLInputElement,
	changesetId: number,
	iColumn: number
]> {
	if ($row.classList.contains('single') || $row.classList.contains('collection')) {
		for (const [iColumn,$cell] of [...$row.cells].entries()) {
			if (!columnFilter(iColumn)) continue
			for (const $changeset of $cell.querySelectorAll(':scope > .changeset')) {
				if (!($changeset instanceof HTMLElement)) continue
				const descriptor=readItemDescriptor($changeset)
				if (!descriptor || descriptor.type!='changeset') continue
				const $checkbox=getItemCheckbox($changeset)
				if (!$checkbox) continue
				yield [$checkbox,descriptor.id,iColumn]
			}
		}
	}
}

function *listRowCellCheckboxes($row: HTMLTableRowElement, iColumn: number): Iterable<[
	$checkbox: HTMLInputElement,
	changesetId: number,
	iColumn: number
]> {
	yield *listRowCheckboxes($row,i=>i==iColumn)
}
