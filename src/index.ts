import Colorizer from './colorizer'
import Net, {checkAuthRedirect, HashServerSelector} from './net'
import {ChangesetViewerDBReader} from './db'
import type {ValidUserQuery} from './osm'
import Grid from './grid'
import More from './more'
import Footer from './footer'
import writeSidebar from './sidebar'
import makeNetDialog from './net-dialog'
import {installRelativeTimeListeners} from './date'
import serverListConfig from './server-list-config'
import {detachValueFromHash, attachValueToBackOfHash} from './util/hash'
import {makeElement, makeDiv, makeLink} from './util/html'
import {p,em} from './util/html-shortcuts'
import {PrefixedLocalStorage} from './util/storage'
import {escapeHash} from './util/escape'
import MapWidget from './map'

const appName='osm-changeset-viewer'

main()

async function main() {
	if (checkAuthRedirect(appName)) {
		return
	}

	const $root=makeDiv('ui')()
	document.body.append($root)
	installRelativeTimeListeners($root)

	const $main=makeElement('main')()(
		makeElement('h1')()(`Changeset viewer`)
	)
	const contentResizeObserver=new ResizeObserver(entries=>{
		const mainWidth=entries[0].target.clientWidth
		$main.style.setProperty('--main-width',`${mainWidth}px`)
	})
	contentResizeObserver.observe($main)

	const $aside=makeElement('aside')()()
	$aside.hidden=true

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
	$root.append($main,$aside,$footer,$netDialog)

	if (!net.cx) {
		$main.append(
			makeDiv('notice')(`Please select a valid server`)
		)
		net.serverSelector.installHashChangeListener(net.cx,()=>{})
		new Footer($root,$footer,$netDialog)
		return
	}

	const cx=net.cx
	let db: ChangesetViewerDBReader
	try {
		db=await ChangesetViewerDBReader.open(cx.server.host)
	} catch (ex) {
		$main.append(
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
	const colorizer=new Colorizer()
	const mapWidget=new MapWidget(colorizer,cx.server.tile)
	const grid=new Grid(colorizer,cx,db,worker,more,
		userQueries=>{
			net.serverSelector.pushHostlessHashInHistory(
				getHashFromUserQueries(userQueries)
			)
		},
		()=>{
			mapWidget.reset()
		},
		()=>{
			mapWidget.redraw()
		},
		(item)=>{
			mapWidget.addItem(item)
		},
		(type,id)=>{
			mapWidget.highlightItem(type,id)
		},
		(type,id)=>{
			mapWidget.unhighlightItem(type,id)
		}
	)
	$main.append(
		makeDiv('notice')(
			`This is a preview v0.3.0. `,
			`If you've been using the previous preview, please delete its databases in the browser.`
		),
		p(
			`In Firefox you can do the following to delete old databases: `,
			em(`Developer tools`),` (F12) > `,em(`Storage`),` > `,em(`Indexed DB`),` > (this website) > `,em(`OsmChangesetViewer[`),`...`,em(`]`),` (there is likely only `,em(`OsmChangesetViewer[www.openstreetmap.org]`),`, multiple databases are possible if you tried using the changeset viewer with different osm servers). `,
			`Right-click each one and select `,em(`Delete`),`.`
		),
		p(
			`In Chrome you can do the following: `,
			em(`DevTools`),` (F12) > `,em(`Application`),` > `,em(`Storage`),` > `,em(`IndexedDB`),` > `,em(`OsmChangesetViewer[`),`...`,em(`]`),`. `,
			`Press the `,em(`Delete database`),` button.`
		),
		grid.$grid,
		more.$div
	)
	writeSidebar($root,$aside,mapWidget)
	const showMap=()=>{
		$aside.hidden=false
		$main.style.gridArea=`main`
	}
	const hideMap=()=>{
		$aside.hidden=true
		$main.style.gridArea=`main / main / aside / aside`
	}
	const footer=new Footer($root,$footer,$netDialog,net.cx.server,grid,more,()=>{
		const hostlessHash=net.serverSelector.getHostlessHash()
		const [,queryHash]=detachValueFromHash('map',hostlessHash)
		if ($aside.hidden) {
			showMap()
			const updatedHostlessHash=attachValueToBackOfHash('map',mapWidget.hashValue,queryHash)
			net.serverSelector.replaceHostlessHashInHistory(updatedHostlessHash)
		} else {
			hideMap()
			net.serverSelector.replaceHostlessHashInHistory(queryHash)
		}
		return !$aside.hidden
	})
	net.serverSelector.installHashChangeListener(net.cx,hostlessHash=>{
		const [mapHashValue,queryHash]=detachValueFromHash('map',hostlessHash)
		if (mapHashValue!=null) {
			mapWidget.hashValue=mapHashValue
			showMap()
			footer.mapVisibility=true
		} else {
			hideMap()
			footer.mapVisibility=false
		}
		grid.receiveUpdatedUserQueries(
			getUserQueriesFromHash(queryHash)
		)
	},true)
	$root.addEventListener('osmChangesetViewer:mapMoveEnd',()=>{
		const hostlessHash=net.serverSelector.getHostlessHash()
		const [,queryHash]=detachValueFromHash('map',hostlessHash)
		const updatedHostlessHash=attachValueToBackOfHash('map',mapWidget.hashValue,queryHash)
		net.serverSelector.replaceHostlessHashInHistory(updatedHostlessHash)
	})
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
