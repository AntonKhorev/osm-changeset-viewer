import Panel from './panel'
import type Grid from '../grid'
import {ItemOptions} from '../grid'
import {makeDisclosureButton, getDisclosureButtonState, setDisclosureButtonState} from '../widgets'
import {makeElement, makeDiv, makeLabel} from '../util/html'

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
			updateItemsGrid: ()=>void,
			itemOptions: ItemOptions,
			legend: string
		)=>{
			const $table=makeElement('table')()()
			{
				const $row=$table.insertRow()
				{
					const $cell=$row.insertCell()
					const $button=makeDisclosureButton(false,`item types`)
					$button.onclick=()=>{
						const state=!getDisclosureButtonState($button)
						for (const $typeRow of $table.querySelectorAll(`tr.for-type`)) {
							if (!($typeRow instanceof HTMLTableRowElement)) continue
							$typeRow.hidden=!state
						}
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
				const $row=$table.insertRow()
				$row.classList.add('for-all')
				{
					const $cell=makeElement('th')()()
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
						for (const $typeCheckbox of $table.querySelectorAll(`tr.for-type td[data-option="${itemOption.name}"] input`)) {
							if (!($typeCheckbox instanceof HTMLInputElement)) continue
							$typeCheckbox.checked=$checkbox.checked
						}
						updateItemsGrid()
					}
					$cell.append($checkbox)
				}
			}
			for (const itemType of itemOptions.allTypes) {
				const $row=$table.insertRow()
				$row.classList.add('for-type')
				$row.hidden=true
				{
					const $cell=$row.insertCell()
					$cell.textContent=itemType
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
						const $allCheckbox=$table.querySelector(`tr.for-all td[data-option="${itemOption.name}"] input`)
						if ($allCheckbox instanceof HTMLInputElement) {
							$allCheckbox.checked=itemOption.all
							$allCheckbox.indeterminate=!itemOption.all && itemOption.some
						}
						updateItemsGrid()
					}
					$cell.append($checkbox)
				}
			}
			return makeElement('fieldset')()(
				makeElement('legend')()(legend),$table
			)
		}
		$section.append(
			makeElement('h2')()(`Grid settings`),
			makeGridCheckbox(
				value=>{
					this.grid.withCompactIds=value
					this.grid.updateTableAfterOptionChanges()
				},
				false,
				`compact ids in collections`
			),
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
				()=>this.grid.updateTableAfterExpandedItemOptionChanges(),
				this.grid.expandedItemOptions,
				`expanded items`
			),
			makeItemOptionsTable(
				()=>this.grid.updateTableAfterCollapsedItemOptionChanges(),
				this.grid.collapsedItemOptions,
				`collapsed items`
			)
		)
	}
}
