import Net, {checkAuthRedirect, HashServerSelector} from './net'
import {toUserQuery} from './query-user'
import {makeElement, makeDiv, makeLabel} from './util/html'
import {PrefixedLocalStorage} from './util/storage'
import {makeEscapeTag} from './util/escape'
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
	net.serverSelector.installHashChangeListener(net.cx,()=>{})

	$root.append(
		makeElement('h1')()(`Changeset viewer`)
	)

	if (net.cx) {
		const cx=net.cx
		const $userInput=makeElement('input')()()
		$userInput.type='text'
		const $form=makeElement('form')()(
			makeDiv('major-input-group')(
				makeLabel()(
					`Username, URL or #id `,$userInput
				)
			),
			makeDiv('major-input-group')(
				makeElement('button')()(`Add user`)
			)
		)
		$userInput.oninput=()=>{
			const userQuery=toUserQuery(cx.server.api,cx.server.web,$userInput.value)
			if (userQuery.userType=='invalid') {
				$userInput.setCustomValidity(userQuery.message)
			} else if (userQuery.userType=='empty') {
				$userInput.setCustomValidity(`user query cannot be empty`)
			} else {
				$userInput.setCustomValidity('')
			}
		}
		$form.onsubmit=async(ev)=>{
			ev.preventDefault()
			const userQuery=toUserQuery(cx.server.api,cx.server.web,$userInput.value)
			if (userQuery.userType=='invalid' || userQuery.userType=='empty') return
			const e=makeEscapeTag(encodeURIComponent)
			let userParameter: string
			if (userQuery.userType=='id') {
				userParameter=e`user=${userQuery.uid}`
			} else {
				userParameter=e`display_name=${userQuery.username}`
			}
			const result=await cx.server.api.fetch(`changesets.json?${userParameter}`)
			const json=await result.json()
			console.log(json)
		}
		$root.append(
			makeElement('h2')()(`Select users and changesets`),
			$form
		)
	} else {
		$root.append(
			makeDiv('notice')(`Please select a valid server`)
		)
	}

	$root.append(
		...net.$sections
	)
}
