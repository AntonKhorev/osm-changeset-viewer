import Panel from './panel'
import type {Server} from '../net'
import type Grid from '../grid'
import {makeElement, makeDiv} from '../util/html'
import {makeEscapeTag} from '../util/escape'

const e=makeEscapeTag(encodeURIComponent)

export default class ActionsPanel extends Panel {
	protected className='tools'
	protected buttonLabel=`Actions`
	constructor(private server: Server, private grid: Grid) {
		super()
	}
	writeSection($section: HTMLElement): void {
		const $copyButton=makeElement('button')()(`Copy URLs to clipboard`)
		$copyButton.onclick=async()=>{
			let text=''
			for (const id of this.grid.listSelectedChangesetIds()) {
				const changesetUrl=this.server.web.getUrl(e`changeset/${id}`)
				text+=changesetUrl+'\n'
			}
			await navigator.clipboard.writeText(text)
		}
		const $rcButton=makeElement('button')()(`Open with RC`)
		$rcButton.onclick=async()=>{
			for (const id of this.grid.listSelectedChangesetIds()) {
				const changesetUrl=this.server.web.getUrl(e`changeset/${id}`)
				const rcPath=e`import?url=${changesetUrl}`
				await openRcPath($rcButton,rcPath)
			}
		}
		$section.append(
			makeElement('h2')()(`Actions`),` `,
			makeDiv('input-group')($copyButton),` `,
			makeDiv('input-group')($rcButton)
		)
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
