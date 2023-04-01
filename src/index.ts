import Net, {checkAuthRedirect, HashServerSelector} from './net'
import type {ValidUserQuery} from './osm'
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

	if (net.cx) {
		const cx=net.cx
		const more=new More()
		const $grid=makeDiv('grid')()
		const gridHead=new GridHead(cx,$grid,userQueries=>{
			net.serverSelector.pushHashToHistory(
				getHashFromUserQueries(userQueries)
			)
		},async(stream)=>{
			for (const $changeset of $grid.querySelectorAll('.changeset')) {
				$changeset.remove()
			}
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
					$changeset.style.gridColumn=String(nUser+1)
					$grid.append($changeset)
				}
				if (nUsersAndChangesets.length==0) {
					more.changeToLoadedAll()
				} else {
					more.changeToLoadMore()
				}
			}
		})
		$content.append(
			makeElement('h2')()(`Select users and changesets`),
			$grid,
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

	writeToolbar($root,$toolbar,$netDialog)
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
