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
		const $buttons: HTMLButtonElement[] = []
		{
			const $button=makeElement('button')()(`Copy URLs to clipboard`)
			$button.onclick=async()=>{
				let text=''
				for (const id of this.grid.listSelectedChangesetIds()) {
					const changesetUrl=this.server.web.getUrl(e`changeset/${id}`)
					text+=changesetUrl+'\n'
				}
				await navigator.clipboard.writeText(text)
			}
			$buttons.push($button)
		}{
			const $button=makeElement('button')()(`Open with RC`)
			$button.onclick=async()=>{
				for (const id of this.grid.listSelectedChangesetIds()) {
					const changesetUrl=this.server.web.getUrl(e`changeset/${id}`)
					const rcPath=e`import?url=${changesetUrl}`
					await openRcPath($button,rcPath)
				}
			}
			$buttons.push($button)
		}{
			const $button=makeElement('button')()(`Revert with RC`)
			$button.onclick=async()=>{
				for (const id of this.grid.listSelectedChangesetIds()) {
					const rcPath=e`revert_changeset?id=${id}`
					await openRcPath($button,rcPath)
				}
			}
			$buttons.push($button)
		}
		$section.append(
			makeElement('h2')()(`Actions`)
		)
		for (const $button of $buttons) {
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
