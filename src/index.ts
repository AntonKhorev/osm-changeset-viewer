import Net, {checkAuthRedirect} from './net'
import {HashServerSelector} from './hash'
import {makeElement, makeDiv} from './util/html'
import {PrefixedLocalStorage} from './util/storage'
import serverListConfig from './server-list-config'

const appName='osm-changeset-viewer'

main()

async function main() {
	if (checkAuthRedirect(appName)) {
		return
	}

	const $root=makeDiv('ui')()
	document.body.append($root)

	const storage=new PrefixedLocalStorage(appName+'-')
	const net=new Net(
		appName,'read_prefs',
		[`In the future you'll need to login to view redacted data.`],
		serverListConfig,
		storage,
		serverList=>new HashServerSelector(serverList),
		()=>{} // TODO event like bubbleEvent($root,'osmChangesetViewer:loginChange')
	)

	$root.append(
		makeElement('h1')()(`Changeset viewer`),
		...net.$sections
	)
}
