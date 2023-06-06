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
		const scrollSyncTimeout=300
		let lastInputScrollTimestamp=0
		let lastOutputScrollTimestamp=0
		let queries: ValidUserQuery[] = []
		const $inputTextarea=makeElement('textarea')()()
		const $outputTextarea=makeElement('textarea')()()
		const $skipMarkersCheckbox=makeElement('input')()()
		const $addButton=makeElement('button')()(`Add users`)
		$outputTextarea.setAttribute('readonly','')
		$inputTextarea.rows=$outputTextarea.rows=10
		$skipMarkersCheckbox.type='checkbox'
		$addButton.disabled=true
		$inputTextarea.onscroll=()=>{
			const t=performance.now()
			if (t-lastOutputScrollTimestamp<scrollSyncTimeout) return
			lastInputScrollTimestamp=t
			$outputTextarea.scrollTop=$inputTextarea.scrollTop
		}
		$outputTextarea.onscroll=()=>{
			const t=performance.now()
			if (t-lastInputScrollTimestamp<scrollSyncTimeout) return
			lastOutputScrollTimestamp=t
			$inputTextarea.scrollTop=$outputTextarea.scrollTop
		}
		$inputTextarea.oninput=$skipMarkersCheckbox.oninput=()=>{
			queries=[]
			let output=``
			for (let line of $inputTextarea.value.split('\n')) {
				if (output) output+=`\n`
				if ($skipMarkersCheckbox.checked) {
					const match=line.match(/^\s*\d*[-.*)]\s+(.*)/)
					if (match) {
						;[,line]=match
					}
				}
				const query=toUserQuery(this.server.api,this.server.web,line)
				if (query.type=='empty') {
					output+=` `
				} else if (query.type=='id') {
					queries.push(query)
					output+=` uid # `+query.uid
				} else if (query.type=='name') {
					queries.push(query)
					output+=`name : `+query.username
				} else {
					output+=`????`
				}
			}
			$outputTextarea.value=output
			$addButton.disabled=queries.length==0
		}
		$addButton.onclick=async()=>{
			await this.grid.addUserQueries(queries)
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
