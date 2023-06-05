import Panel from './panel'
import type {Server} from '../net'
import type Grid from '../grid'
import {makeElement, makeDiv, makeLabel} from '../util/html'

export default class ListPanel extends Panel {
	protected className='list'
	protected buttonLabel=`List of users`
	constructor(private server: Server, private grid: Grid) {
		super()
	}
	writeSection($section: HTMLElement): void {
		const $inputTextarea=makeElement('textarea')()()
		const $outputTextarea=makeElement('textarea')()()
		const $skipMarkersCheckbox=makeElement('input')()()
		const $addButton=makeElement('button')()(`Add users`)
		$outputTextarea.disabled=true
		$inputTextarea.rows=$outputTextarea.rows=10
		$skipMarkersCheckbox.type='checkbox'
		$addButton.disabled=true
		$section.append(
			makeElement('h2')()(`Add a list of users`),
			makeDiv('io')(
				makeDiv()(
					makeDiv('major-input-group')(
						makeLabel()(
							`Input list of users `,
							$inputTextarea,
						)
					),
					makeDiv('input-group')(
						makeLabel()(
							$skipMarkersCheckbox,
							` remove list markers`
						)
					)
				),
				makeDiv()(
					makeDiv('major-input-group')(
						makeLabel()(
							`Parsed list of users `,
							$outputTextarea,
						)
					),
					makeDiv('major-input-group')(
						$addButton
					)
				)
			)
		)
	}
}
