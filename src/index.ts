import Net, {checkAuthRedirect, HashServerSelector} from './net'
import type {ValidUserQuery} from './osm'
import Grid from './grid'
import More from './more'
import writeToolbar from './toolbar'
import makeNetDialog from './net-dialog'
import GridHead from './grid-head'
import {installRelativeTimeListeners, makeDateOutputFromString} from './date'
import serverListConfig from './server-list-config'
import {makeElement, makeDiv, makeLink} from './util/html'
import {PrefixedLocalStorage} from './util/storage'
import {escapeHash, makeEscapeTag} from './util/escape'

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
		const more=new More()
		const grid=new Grid()
		$grid=grid.$grid
		document.body.append(grid.$style)
		const gridHead=new GridHead(cx,grid,userQueries=>{
			net.serverSelector.pushHostlessHashInHistory(
				getHashFromUserQueries(userQueries)
			)
		},async(stream)=>{
			if (stream) {
				more.changeToLoadMore()
				more.$button.onclick=async()=>{
					const e=makeEscapeTag(encodeURIComponent)
					more.changeToLoading()
					const nUsersAndChangesets=await stream.fetch()
					for (const [nUser,changeset] of nUsersAndChangesets) {
						const $changeset=makeDiv('changeset')(
							makeLink(`${changeset.id}`,cx.server.web.getUrl(e`changeset/${changeset.id}`)),` `,
							makeDateOutputFromString(changeset.created_at),` `,
							changeset.tags?.comment ?? ''
						)
						grid.appendChangeset($changeset,nUser)
					}
					if (nUsersAndChangesets.length==0) {
						more.changeToLoadedAll()
					} else {
						more.changeToLoadMore()
					}
				}
			} else {
				more.changeToNotingToLoad()
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

	writeToolbar($root,$toolbar,$netDialog,$grid)
}

function getUserQueriesFromHash(hash: string): ValidUserQuery[] {
	const queries=[] as ValidUserQuery[]
	for (const hashEntry of hash.split('&')) {
		const match=hashEntry.match(/([^=]*)=(.*)/)
		if (!match) continue
		const [,k,v]=match
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
