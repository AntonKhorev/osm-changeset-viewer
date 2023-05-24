import {readItemDescriptor} from './info'
import {getItemCheckbox} from './body-item'

export default class GridBodyCheckboxHandler {
	onItemSelect: ()=>void = ()=>{}
	private readonly wrappedClickListener: (this: HTMLElement, ev: MouseEvent)=>void
	// TODO remember last clicked checkbox and its column for shift selection
	// TODO reset remembered checkbox
	// - when rewriting tbody
	// - when reordering columns
	constructor(private $gridBody: HTMLTableSectionElement) {
		const self=this
		this.wrappedClickListener=function(ev: MouseEvent){
			if (!(this instanceof HTMLInputElement)) return
			self.clickListener(this,ev.shiftKey)
		}
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
		const selectedChangesetIds=Array<Set<number>>(nColumns).fill(new Set())
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
		const $row=$clickedCheckbox.closest('tr')
		if ($row) {
			const isChecked=$clickedCheckbox.checked
			const targetChangesetIds=new Set<number>()
			for (const [$checkbox,changesetId] of listRowCheckboxes($row)) {
				if ($clickedCheckbox==$checkbox) {
					targetChangesetIds.add(changesetId)
				}
			}
			for (const [$checkbox,changesetId] of listRowCheckboxes($row)) {
				if (!targetChangesetIds.has(changesetId)) continue
				$checkbox.checked=isChecked
			}
		}
		this.onItemSelect()
	}
}

function *listRowCheckboxes($row: HTMLTableRowElement): Iterable<[
	$checkbox: HTMLInputElement,
	changesetId: number,
	iColumn: number
]> {
	if ($row.classList.contains('changeset')) {
		const descriptor=readItemDescriptor($row)
		if (!descriptor || descriptor.type!='changeset') return
		for (const [iColumn,$cell] of [...$row.cells].entries()) {
			const $checkbox=getItemCheckbox($cell)
			if (!$checkbox) continue
			yield [$checkbox,descriptor.id,iColumn]
		}
	} else if ($row.classList.contains('collection')) {
		for (const [iColumn,$cell] of [...$row.cells].entries()) {
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

// TODO just use *listRowCheckboxes with column filter
function *listRowCellCheckboxes($row: HTMLTableRowElement, iColumn: number): Iterable<[
	$checkbox: HTMLInputElement,
	changesetId: number
]> {
	if ($row.classList.contains('changeset')) {
		const descriptor=readItemDescriptor($row)
		if (!descriptor || descriptor.type!='changeset') return
		const $cell=$row.cells[iColumn]
		if ($cell) {
			const $checkbox=getItemCheckbox($cell)
			if (!$checkbox) return
			yield [$checkbox,descriptor.id]
		}
	} else if ($row.classList.contains('collection')) {
		const $cell=$row.cells[iColumn]
		if ($cell) {
			for (const $changeset of $cell.querySelectorAll(':scope > .changeset')) {
				if (!($changeset instanceof HTMLElement)) continue
				const descriptor=readItemDescriptor($changeset)
				if (!descriptor || descriptor.type!='changeset') continue
				const $checkbox=getItemCheckbox($changeset)
				if (!$checkbox) continue
				yield [$checkbox,descriptor.id]
			}
		}
	}
}
