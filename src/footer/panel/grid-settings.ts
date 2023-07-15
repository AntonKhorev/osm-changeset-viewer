import Panel from './base'
import type Grid from '../../grid'
import {ItemOptions} from '../../grid'
import {makeDisclosureButton, getDisclosureButtonState, setDisclosureButtonState} from '../../widgets'
import {makeElement, makeDiv, makeLabel} from '../../util/html'

export default class GridSettingsPanel extends Panel {
	protected className='tools'
	protected buttonLabel=`Grid settings`
	constructor(private grid: Grid) {
		super()
	}
	writeSection($section: HTMLElement): void {
		const makeGridCheckbox=(
			setOption: (value:boolean)=>void,
			initialValue: boolean,
			label: string, labelTitle?: string
		)=>{
			const $checkbox=makeElement('input')()()
			$checkbox.type='checkbox'
			$checkbox.checked=initialValue
			$checkbox.oninput=()=>setOption($checkbox.checked)
			const $label=makeLabel()(
				$checkbox,` `,label
			)
			if (labelTitle) $label.title=labelTitle
			return makeDiv('input-group')($label)
		}
		const makeItemOptionsTable=(
			itemOptions: ItemOptions,
			legend: string,
			updateGridAfterOptionChanges: ()=>void,
			updateGridAfterAbbreviationOptionChanges?: ()=>void
		)=>{
			const $table=makeElement('table')()()
			const $headSection=makeElement('thead')()(); $table.append($headSection)
			const $allSection=makeElement('tbody')()(); $table.append($allSection)
			const $typeSection=makeElement('tbody')()(); $table.append($typeSection); $typeSection.hidden=true
			{
				const $row=$headSection.insertRow()
				{
					const $cell=$row.insertCell()
					const $button=makeDisclosureButton(false,`item types`)
					$button.onclick=()=>{
						const state=!getDisclosureButtonState($button)
						$typeSection.hidden=!state
						setDisclosureButtonState($button,state)
					}
					$cell.append($button)
				}
				for (const itemOption of itemOptions) {
					const $cell=makeElement('th')()(itemOption.label)
					$cell.title=itemOption.title??itemOption.name
					$row.append($cell)
				}
			}{
				const $row=$allSection.insertRow()
				{
					const $cell=makeElement('th')()()
					$cell.textContent=`all item types`
					$row.append($cell)
				}
				for (const itemOption of itemOptions) {
					const $cell=$row.insertCell()
					$cell.dataset.option=itemOption.name
					const $checkbox=makeElement('input')()()
					$checkbox.type='checkbox'
					$checkbox.checked=itemOption.all
					$checkbox.oninput=()=>{
						itemOption.all=$checkbox.checked
						for (const $typeCheckbox of $typeSection.querySelectorAll(`td[data-option="${itemOption.name}"] input`)) {
							if (!($typeCheckbox instanceof HTMLInputElement)) continue
							$typeCheckbox.checked=$checkbox.checked
						}
						updateGridAfterOptionChanges()
					}
					$cell.append($checkbox)
				}
			}
			type ItemType = typeof itemOptions.allTypes extends Set<infer T> ? T : never
			type ItemOption = typeof itemOptions extends Iterable<infer T> ? T : never
			const writeSingleOptionRow=(
				$row: HTMLTableRowElement,
				itemType: ItemType,
				checkboxListener: (itemOption:ItemOption)=>void
			)=>{
				{
					const $cell=makeElement('th')()()
					$cell.textContent=itemType
					$row.append($cell)
				}
				for (const itemOption of itemOptions) {
					const $cell=$row.insertCell()
					$cell.dataset.option=itemOption.name
					if (!itemOption.hasType(itemType)) continue
					const $checkbox=makeElement('input')()()
					$checkbox.type='checkbox'
					$checkbox.checked=itemOption[itemType]
					$checkbox.oninput=()=>{
						itemOption[itemType]=$checkbox.checked
						checkboxListener(itemOption)
					}
					$cell.append($checkbox)
				}
			}
			for (const itemType of itemOptions.allTypes) {
				const $row=$typeSection.insertRow()
				writeSingleOptionRow($row,itemType,itemOption=>{
					const $allCheckbox=$allSection.querySelector(`td[data-option="${itemOption.name}"] input`)
					if ($allCheckbox instanceof HTMLInputElement) {
						$allCheckbox.checked=itemOption.all
						$allCheckbox.indeterminate=!itemOption.all && itemOption.some
					}
					updateGridAfterOptionChanges()
				})
			}
			if (updateGridAfterAbbreviationOptionChanges) {
				const $abbrSection=makeElement('tbody')()(); $table.append($abbrSection)
				const $row=$abbrSection.insertRow()
				writeSingleOptionRow($row,'abbreviate',()=>updateGridAfterOptionChanges())
			}
			return makeElement('fieldset')()(
				makeElement('legend')()(legend),$table
			)
		}
		$section.append(
			makeElement('h2')()(`Grid settings`),
			makeGridCheckbox(
				value=>{
					this.grid.withClosedChangesets=value
					this.grid.updateTableAfterOptionChanges()
				},
				false,
				`changeset close events`,
				`visible only if there's some other event between changeset opening and closing`
			),
			makeItemOptionsTable(
				this.grid.expandedItemOptions,
				`expanded items`,
				()=>this.grid.updateTableAfterExpandedItemOptionChanges()
			),
			makeItemOptionsTable(
				this.grid.collapsedItemOptions,
				`collapsed items`,
				()=>this.grid.updateTableAfterCollapsedItemOptionChanges(),
				()=>this.grid.updateTableAfterAbbreviationOptionChanges(),
			)
		)
	}
}
