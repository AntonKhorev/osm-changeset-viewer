import Panel from './panel'
import type Grid from '../grid'
import {ItemOptions, makeCollectionIcon, makeSingleIcon} from '../grid'
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
			fieldsetClass: string,
			$icon: HTMLElement
		)=>{
			const $table=makeElement('table')()()
			{
				const $row=$table.insertRow()
				for (const itemOption of itemOptions) {
					const $cell=makeElement('th')()(itemOption.label)
					$cell.title=itemOption.title??itemOption.name
					$row.append($cell)
				}
			}{
				const $row=$table.insertRow()
				for (const itemOption of itemOptions) {
					const $cell=$row.insertCell()
					const $checkbox=makeElement('input')()()
					$checkbox.type='checkbox'
					$checkbox.checked=itemOption.all
					$checkbox.oninput=()=>{
						itemOption.all=$checkbox.checked
						updateItemsGrid()
					}
					$cell.append($checkbox)
				}
			}
			return makeElement('fieldset')(fieldsetClass)(
				makeElement('legend')()($icon),$table
			)
		}
		const $expandedIcon=makeSingleIcon()
		$expandedIcon.title=`expanded items`
		const $collapsedIcon=makeCollectionIcon()
		$collapsedIcon.title=`collapsed items`
		$section.append(
			makeElement('h2')()(`Grid settings`),
			makeGridCheckbox(
				value=>{
					this.grid.withCompactIds=value
					this.grid.updateTableAccordingToSettings()
				},
				false,
				`compact ids in collections`
			),
			makeGridCheckbox(
				value=>{
					this.grid.withClosedChangesets=value
					this.grid.updateTableAccordingToSettings()
				},
				false,
				`changeset close events`,
				`visible only if there's some other event between changeset opening and closing`
			),
			makeItemOptionsTable(
				()=>this.grid.updateTableAccordingToExpandedItemOptions(),
				this.grid.expandedItemOptions,
				'for-expanded-items',
				$expandedIcon
			),
			makeItemOptionsTable(
				()=>this.grid.updateTableAccordingToCollapsedItemOptions(),
				this.grid.collapsedItemOptions,
				'for-collapsed-items',
				$collapsedIcon
			)
		)
	}
}
