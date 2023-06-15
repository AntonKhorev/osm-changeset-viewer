import Net, {checkAuthRedirect, HashServerSelector} from './net'
import {ChangesetViewerDBReader} from './db'
import type {ValidUserQuery} from './osm'
import Grid from './grid'
import More from './more'
import writeFooter from './footer'
import makeNetDialog from './net-dialog'
import {installRelativeTimeListeners} from './date'
import serverListConfig from './server-list-config'
import {makeElement, makeDiv, makeLink} from './util/html'
import {p} from './util/html-shortcuts'
import {PrefixedLocalStorage} from './util/storage'
import {escapeHash} from './util/escape'

const appName='osm-changeset-viewer'

main()

async function main() {
	if (checkAuthRedirect(appName)) {
		return
	}

	const $root=makeDiv('ui')()
	document.body.append($root)
	installRelativeTimeListeners($root)

	const $content=makeElement('main')()(
		makeElement('h1')()(`Changeset viewer`)
	)
	const contentResizeObserver=new ResizeObserver(entries=>{
		const mainWidth=entries[0].target.clientWidth
		$content.style.setProperty('--main-width',`${mainWidth}px`)
	})
	contentResizeObserver.observe($content)

	const storage=new PrefixedLocalStorage(appName+'-')
	const net=new Net(
		appName,'read_prefs',
		[`In the future you'll need to login to view redacted data.`],
		serverListConfig,
		storage,
		serverList=>new HashServerSelector(serverList),
		()=>{} // TODO event like bubbleEvent($root,'osmChangesetViewer:loginChange')
	)

	const $footer=makeElement('footer')()()
	const $netDialog=makeNetDialog(net)
	$root.append($content,$footer,$netDialog)
	let $grid: HTMLElement|undefined

	if (!net.cx) {
		$content.append(
			makeDiv('notice')(`Please select a valid server`)
		)
		net.serverSelector.installHashChangeListener(net.cx,()=>{})
		writeFooter($root,$footer,$netDialog)
		return
	}

	const cx=net.cx
	let db: ChangesetViewerDBReader
	try {
		db=await ChangesetViewerDBReader.open(cx.server.host)
	} catch (ex) {
		$content.append(
			makeDiv('notice')(`Cannot open the database`),
			p(
				`This app uses `,makeLink(`IndexedDB`,`https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API`),` to store downloaded request results. `,
				`Some browsers may restrict access to IndexedDB in private/incognito mode. `,
				`If you are using private windows in Firefox, you may try `,makeLink(`this workaround`,`https://bugzilla.mozilla.org/show_bug.cgi?id=1639542#c9`),`.`
			)
		)
		return
	}
	const worker=new SharedWorker('worker.js')
	const more=new More()
	const grid=new Grid(cx,db,worker,more,userQueries=>{
		net.serverSelector.pushHostlessHashInHistory(
			getHashFromUserQueries(userQueries)
		)
	})
	$grid=grid.$grid
	$content.append(
		makeElement('h2')()(`Select users and changesets`),
		grid.$grid,
		more.$div
	)
	net.serverSelector.installHashChangeListener(net.cx,hostlessHash=>{
		grid.receiveUpdatedUserQueries(
			getUserQueriesFromHash(hostlessHash)
		)
	},true)
	writeFooter($root,$footer,$netDialog,net.cx.server,grid,more)
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
