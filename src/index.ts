import Net, {checkAuthRedirect, HashServerSelector, WebProvider} from './net'
import type {ChangesetDbRecord} from './db'
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
		},(changesetBatch,requestMore)=>{
			if (requestMore) {
				more.changeToLoadMore()
				let first=true
				for (const [iColumns,changeset] of changesetBatch) {
					grid.startNewRow(changeset.createdAt)
					// TODO possibly insert in the middle
					for (const iColumn of iColumns) {
						const $changeset=makeChangesetCard(cx.server.web,changeset)
						if (first) {
							first=false
						} else {
							$changeset.classList.add('duplicate')
						}
						grid.appendChangeset($changeset,iColumn)
					}
				}
				more.$button.onclick=()=>{
					more.changeToLoading()
					requestMore()
				}
			} else {
				// more.changeToNothingToLoad()
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

function makeChangesetCard(web: WebProvider, changeset: ChangesetDbRecord) {
	return makeDiv('changeset')(
		makeLink(`${changeset.id}`,web.getUrl(e`changeset/${changeset.id}`)),` `,
		makeDateOutput(changeset.createdAt),` `,
		changeset.tags?.comment ?? ''
	)
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
