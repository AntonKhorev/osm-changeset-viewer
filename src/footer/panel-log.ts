import Panel from './panel'
import type {Server} from '../net'
import {WorkerBroadcastReceiver} from '../broadcast-channel'
import {makeElement, makeDiv, makeLink} from '../util/html'
import {ul,li} from '../util/html-shortcuts'

export default class LogPanel extends Panel {
	protected className='log'
	protected buttonLabel=`Fetch log`
	constructor(private server: Server) {
		super()
	}
	writeSection($section: HTMLElement): void {
		const $logList=ul()
		const $logClearButton=makeElement('button')()(`clear`)
		$logClearButton.onclick=()=>{
			$logList.replaceChildren()
		}
		$section.append(
			makeElement('h2')()(`Fetches`),
			makeDiv('controls')($logClearButton),
			$logList
		)
		const broadcastReceiver=new WorkerBroadcastReceiver(this.server.host)
		broadcastReceiver.onmessage=({data:message})=>{
			if (message.type!='log' || message.part.type!='fetch') return
			const atBottom=$section.offsetHeight+$section.scrollTop>=$section.scrollHeight-16
			const path=message.part.path
			let docHref: string|undefined
			if (path.startsWith(`changesets.json`)) {
				docHref=`https://wiki.openstreetmap.org/wiki/API_v0.6#Query:_GET_/api/0.6/changesets`
			} else if (path.startsWith(`notes/search.json`)) {
				docHref=`https://wiki.openstreetmap.org/wiki/API_v0.6#Search_for_notes:_GET_/api/0.6/notes/search`
			} else if (path.match(/^user\/\d+\.json/)) {
				docHref=`https://wiki.openstreetmap.org/wiki/API_v0.6#Details_of_a_user:_GET_/api/0.6/user/#id`
			}
			const href=this.server.api.getUrl(path)
			const $li=li(
				makeLink(href,href)
			)
			if (docHref) {
				$li.append(
					` [`,makeLink(`?`,docHref),`]`
				)
			}
			$logList.append($li)
			if (atBottom) {
				$li.scrollIntoView()
			}
		}
	}
}
