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
			$checkbox.oninput=()=>{
				setOption($checkbox.checked)
				this.grid.updateTableAccordingToSettings()
			}
			const $label=makeLabel()(
				$checkbox,` `,label
			)
			if (labelTitle) $label.title=labelTitle
			return makeDiv('input-group')($label)
		}
		const makeItemOptionsFieldset=(
			itemOptions: ItemOptions,
			legend: string
		)=>{
			return makeElement('fieldset')()(
				makeElement('legend')()(legend),
				...itemOptions.list().map(({get,set,label,title})=>makeGridCheckbox(set,get(),label,title))
			)
		}
		$section.append(
			makeElement('h2')()(`Grid settings`),
			makeGridCheckbox(
				value=>this.grid.withCompactIds=value,
				false,
				`compact ids in collections`
			),
			makeGridCheckbox(
				value=>this.grid.withClosedChangesets=value,
				false,
				`changeset close events`,
				`visible only if there's some other event between changeset opening and closing`
			),
			makeItemOptionsFieldset(this.grid.expandedItemOptions,`Expanded`),
			makeItemOptionsFieldset(this.grid.collapsedItemOptions,`Collapsed`)
		)
	}
}
