import Panel from './panel'
import type Grid from '../grid'
import type {ItemOptions} from '../grid'
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
		const makeItemOptionsFieldset=(
			updateTable: ()=>void,
			itemOptions: ItemOptions,
			legend: string
		)=>{
			return makeElement('fieldset')()(
				makeElement('legend')()(legend),
				...itemOptions.list.map(({get,set,label,name,title})=>makeGridCheckbox(
					value=>{
						set(value)
						updateTable()
					},
					get(),
					label,
					title??name
				))
			)
		}
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
			// makeItemOptionsFieldset(this.grid.expandedItemOptions,`expanded items`),
			makeItemOptionsFieldset(
				()=>this.grid.updateTableAccordingToCollapsedItemOptions(),
				this.grid.collapsedItemOptions,
				`collapsed items`
			)
		)
	}
}
