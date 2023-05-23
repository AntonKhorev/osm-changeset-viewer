import Panel from './panel'
import type Grid from '../grid'
import {makeElement, makeDiv, makeLabel} from '../util/html'

export default class GridSettingsPanel extends Panel {
	protected className='grid-settings'
	protected buttonLabel=`Grid settings`
	constructor(private grid: Grid) {
		super()
	}
	writeSection($section: HTMLElement): void {
		const makeGridCheckbox=(
			setOption: (value:boolean)=>void,
			label: string, labelTitle?: string
		)=>{
			const $checkbox=makeElement('input')()()
			$checkbox.type='checkbox'
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
		$section.append(
			makeElement('h2')()(`Grid settings`),
			makeGridCheckbox(
				value=>this.grid.withCompactIds=value,
				`compact ids in collections`
			),
			makeGridCheckbox(
				value=>this.grid.withClosedChangesets=value,
				`changeset close events`,`visible only if there's some other event between changeset opening and closing`
			),
			makeGridCheckbox(
				value=>this.grid.inOneColumn=value,
				`one column`
			)
		)
	}
}
