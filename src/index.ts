import Net, {checkAuthRedirect, HashServerSelector} from './net'
import makeNetDialog from './net-dialog'
import {toUserQuery} from './osm'
import ChangesetStream from './changeset-stream'
import {makeElement, makeDiv, makeLabel} from './util/html'
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
	net.serverSelector.installHashChangeListener(net.cx,()=>{})
	const $content=makeDiv('content')()
	const $toolbar=makeDiv('toolbar')()
	const $netDialog=makeNetDialog(net)
	$root.append($content,$toolbar,$netDialog)

	$content.append(
		makeElement('h1')()(`Changeset viewer`)
	)

	if (net.cx) {
		const cx=net.cx
		const $userInput=makeElement('input')()()
		$userInput.type='text'
		$userInput.name='user'
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
		const $results=makeDiv()()
		$userInput.oninput=()=>{
			const userQuery=toUserQuery(cx.server.api,cx.server.web,$userInput.value)
			if (userQuery.type=='invalid') {
				$userInput.setCustomValidity(userQuery.message)
			} else if (userQuery.type=='empty') {
				$userInput.setCustomValidity(`user query cannot be empty`)
			} else {
				$userInput.setCustomValidity('')
			}
		}
		$form.onsubmit=async(ev)=>{
			ev.preventDefault()
			const userQuery=toUserQuery(cx.server.api,cx.server.web,$userInput.value)
			if (userQuery.type=='invalid' || userQuery.type=='empty') return
			const stream=new ChangesetStream(cx,userQuery)
			const $ul=makeElement('ul')()()
			const $moreButton=makeElement('button')()(`Load more`)
			$results.replaceChildren($ul,$moreButton)
			$moreButton.onclick=async()=>{
				$moreButton.disabled=true
				$moreButton.textContent=`Loading...`
				const changesets=await stream.fetch()
				for (const changeset of changesets) {
					$ul.append(makeElement('li')()(
						changeset.tags?.comment ?? ''
					))
				}
				if (changesets.length==0) {
					$moreButton.textContent
					$moreButton.textContent=`Loaded all changesets`
				} else {
					$moreButton.disabled=false
					$moreButton.textContent=`Load more`
				}
			}
		}
		$content.append(
			makeElement('h2')()(`Select users and changesets`),
			$form,
			$results
		)
	} else {
		$content.append(
			makeDiv('notice')(`Please select a valid server`)
		)
	}

	{
		const $netButton=makeElement('button')()(`Manage servers and logins`)
		$toolbar.append($netButton)
		$netButton.onclick=()=>{
			$netDialog.showModal()
		}
	}
}
