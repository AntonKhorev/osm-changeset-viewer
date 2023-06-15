import Panel from './panel'
import type {Server} from '../net'
import type Grid from '../grid'
import {makeElement, makeDiv, makeLabel} from '../util/html'
import {makeEscapeTag} from '../util/escape'

const e=makeEscapeTag(encodeURIComponent)

export default class ActionsPanel extends Panel {
	protected className='tools'
	protected buttonLabel=`Actions`
	constructor(private server: Server, private grid: Grid) {
		super()
	}
	writeSection($section: HTMLElement): void {
		$section.append(
			makeElement('h2')()(`Actions`)
		)
		{
			const $typeSelect=makeElement('select')()(
				new Option('URLs'),
				new Option('ids')
			)
			const $separatorInput=makeElement('input')()()
			$separatorInput.type='text'
			$separatorInput.size=3
			$separatorInput.value=`\\n`
			const $button=makeElement('button')()(`📋`)
			$button.onclick=async()=>{
				const separator=$separatorInput.value.replace(/\\(.)/g,(_,c)=>{
					if (c=='n') return '\n'
					if (c=='t') return '\t'
					return c
				})
				let text=''
				let first=true
				for (const id of this.grid.listSelectedChangesetIds()) {
					if (first) {
						first=false
					} else {
						text+=separator
					}
					if ($typeSelect.value=='URLs') {
						const changesetUrl=this.server.web.getUrl(e`changeset/${id}`)
						text+=changesetUrl
					} else {
						text+=id
					}
				}
				await navigator.clipboard.writeText(text)
			}
			$section.append(makeDiv('input-group')(
				`Copy `,$typeSelect,` `,
				makeLabel()(`separated by `,$separatorInput),` `,
				`to clipboard `,$button
			))
		}{
			const $button=makeElement('button')()(`Open with RC`)
			$button.onclick=async()=>{
				for (const id of this.grid.listSelectedChangesetIds()) {
					const changesetUrl=this.server.web.getUrl(e`changeset/${id}`)
					const rcPath=e`import?url=${changesetUrl}`
					await openRcPath($button,rcPath)
				}
			}
			$section.append(makeDiv('input-group')($button))
		}{
			const $button=makeElement('button')()(`Revert with RC`)
			$button.onclick=async()=>{
				for (const id of this.grid.listSelectedChangesetIds()) {
					const rcPath=e`revert_changeset?id=${id}`
					await openRcPath($button,rcPath)
				}
			}
			$section.append(makeDiv('input-group')($button))
		}
	}
}

async function openRcPath($button: HTMLButtonElement, rcPath: string): Promise<boolean> {
	const rcUrl=`http://127.0.0.1:8111/`+rcPath
	try {
		const response=await fetch(rcUrl)
		if (response.ok) {
			clearError()
			return true
		}
	} catch {}
	setError()
	return false
	function setError() {
		$button.classList.add('error')
		$button.title='Remote control command failed. Make sure you have an editor open and remote control enabled.'
	}
	function clearError() {
		$button.classList.remove('error')
		$button.title=''
	}
}
