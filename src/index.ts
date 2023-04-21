import Net, {checkAuthRedirect, HashServerSelector, WebProvider} from './net'
import type {ChangesetDbRecord, NoteDbRecord} from './db'
import {ChangesetViewerDBReader} from './db'
import type {ValidUserQuery} from './osm'
import Grid from './grid'
import More from './more'
import writeToolbar from './toolbar'
import makeNetDialog from './net-dialog'
import GridHead from './grid-head'
import {installRelativeTimeListeners, makeDateOutput} from './date'
import serverListConfig from './server-list-config'
import {makeElement, makeDiv, makeLink} from './util/html'
import {code} from './util/html-shortcuts'
import {PrefixedLocalStorage} from './util/storage'
import {escapeHash, makeEscapeTag} from './util/escape'

const e=makeEscapeTag(encodeURIComponent)

const appName='osm-changeset-viewer'

main()

async function main() {
	if (checkAuthRedirect(appName)) {
		return
	}

	const $root=makeDiv('ui')()
	document.body.append($root)
	installRelativeTimeListeners($root)

	const storage=new PrefixedLocalStorage(appName+'-')
	const net=new Net(
		appName,'read_prefs',
		[`In the future you'll need to login to view redacted data.`],
		serverListConfig,
		storage,
		serverList=>new HashServerSelector(serverList),
		()=>{} // TODO event like bubbleEvent($root,'osmChangesetViewer:loginChange')
	)
	const $content=makeElement('main')()(
		makeElement('h1')()(`Changeset viewer`)
	)
	const $toolbar=makeElement('footer')()()
	const $netDialog=makeNetDialog(net)
	$root.append($content,$toolbar,$netDialog)
	let $grid: HTMLElement|undefined

	if (net.cx) {
		const cx=net.cx
		const db=await ChangesetViewerDBReader.open(cx.server.host)
		const worker=new SharedWorker('worker.js')
		const more=new More()
		const grid=new Grid()
		$grid=grid.$grid
		document.body.append(grid.$style)
		const gridHead=new GridHead(cx,db,worker,grid,userQueries=>{
			net.serverSelector.pushHostlessHashInHistory(
				getHashFromUserQueries(userQueries)
			)
		},()=>{
			more.changeToNothingToLoad()
			more.$button.onclick=null
		},(requestNextBatch)=>{
			more.changeToLoad()
			more.$button.onclick=()=>{
				more.changeToLoading()
				requestNextBatch()
			}
		},(batch)=>{
			let wroteAnyItem=false
			for (const {iColumns,type,item} of batch) {
				let $item: HTMLElement
				let date=item.createdAt
				if (type=='changeset'||type=='changesetClose') {
					$item=makeChangesetCard(cx.server.web,item,type=='changesetClose')
					if (type=='changesetClose' && item.closedAt) {
						date=item.closedAt
					}
				} else {
					$item=makeNoteCard(cx.server.web,item)
					date=item.createdAt
				}
				grid.addItem($item,iColumns,date,type,item.id)
				wroteAnyItem=true
			}
			if (wroteAnyItem) {
				more.changeToLoadMore()
			} else {
				more.changeToLoadedAll()
				more.$button.onclick=null
			}
		})
		$content.append(
			makeElement('h2')()(`Select users and changesets`),
			grid.$grid,
			more.$div
		)
		net.serverSelector.installHashChangeListener(net.cx,hostlessHash=>{
			gridHead.receiveUpdatedUserQueries(
				getUserQueriesFromHash(hostlessHash)
			)
		},true)
	} else {
		$content.append(
			makeDiv('notice')(`Please select a valid server`)
		)
		net.serverSelector.installHashChangeListener(net.cx,()=>{})
	}

	writeToolbar($root,$toolbar,$netDialog,$grid,net.cx?.server.host)
}

function makeChangesetCard(web: WebProvider, changeset: ChangesetDbRecord, isClosed: boolean): HTMLElement {
	const makeDate=()=>{
		const date=isClosed ? changeset.closedAt : changeset.createdAt
		return date ? makeDateOutput(date) : `???`
	}
	let $item: HTMLElement
	if (isClosed) {
		const $noCheckbox=makeElement('span')('no-checkbox')()
		$noCheckbox.tabIndex=0
		$noCheckbox.title=`closed changeset ${changeset.id}`
		$item=makeItemCard('changeset',$noCheckbox)
	} else {
		const $checkbox=makeElement('input')()()
		$checkbox.type='checkbox'
		$checkbox.title=`opened changeset ${changeset.id}`
		$item=makeItemCard('changeset',$checkbox)
	}
	$item.append(
		makeLink(`${changeset.id}`,web.getUrl(e`changeset/${changeset.id}`)),` `,
		makeDate(),` `,
		changeset.tags?.comment ?? ''
	)
	if (isClosed) $item.classList.add('closed')
	return $item
}

function makeNoteCard(web: WebProvider, note: NoteDbRecord): HTMLElement {
	const $item=makeItemCard('note',code(`N!`))
	$item.append(
		makeLink(`${note.id}`,web.getUrl(e`note/${note.id}`)),` `,
		makeDateOutput(note.createdAt),` `,
		note.openingComment ?? ''
	)
	return $item
}

function makeItemCard(type: string, $iconChild: HTMLElement): HTMLElement {
	const $icon=makeElement('span')('icon')($iconChild)
	const $item=makeDiv('item',type)($icon,` `)
	return $item
}

function getUserQueriesFromHash(hash: string): ValidUserQuery[] {
	const queries=[] as ValidUserQuery[]
	for (const hashEntry of hash.split('&')) {
		const match=hashEntry.match(/([^=]*)=(.*)/)
		if (!match) continue
		const [,k,ev]=match
		const v=decodeURIComponent(ev)
		if (k=='user') {
			queries.push({
				type: 'name',
				username: v
			})
		} else if (k=='uid') {
			queries.push({
				type: 'id',
				uid: Number(v)
			})
		}
	}
	return queries
}

function getHashFromUserQueries(queries: ValidUserQuery[]): string {
	return queries.map(query=>{
		if (query.type=='name') {
			return `user=`+escapeHash(query.username)
		} else {
			return `uid=`+escapeHash(String(query.uid))
		}
	}).join('&')
}
