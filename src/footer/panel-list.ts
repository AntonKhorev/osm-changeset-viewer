import Panel from './panel'
import type {Server} from '../net'
import type Grid from '../grid'
import type {ValidUserQuery} from '../osm'
import {toUserQuery} from '../osm'
import {makeElement, makeDiv, makeLabel} from '../util/html'

export default class ListPanel extends Panel {
	protected className='list'
	protected buttonLabel=`List of users`
	constructor(private server: Server, private grid: Grid) {
		super()
	}
	writeSection($section: HTMLElement): void {
		let queries: ValidUserQuery[] = []
		const $inputTextarea=makeElement('textarea')()()
		const $outputTextarea=makeElement('textarea')()()
		const $skipMarkersCheckbox=makeElement('input')()()
		const $addButton=makeElement('button')()(`Add users`)
		$outputTextarea.disabled=true
		$inputTextarea.rows=$outputTextarea.rows=10
		$skipMarkersCheckbox.type='checkbox'
		$addButton.disabled=true
		$inputTextarea.oninput=()=>{
			queries=[]
			let output=``
			for (const line of $inputTextarea.value.split('\n')) {
				const query=toUserQuery(this.server.api,this.server.web,line)
				if (query.type=='empty') {
				} else if (query.type=='id') {
					queries.push(query)
					output+=` uid | `+query.uid
				} else if (query.type=='name') {
					queries.push(query)
					output+=`name | `+query.username
				} else {
					output+=`????`
				}
				output+=`\n`
			}
			$outputTextarea.value=output
			$addButton.disabled=queries.length==0
		}
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
