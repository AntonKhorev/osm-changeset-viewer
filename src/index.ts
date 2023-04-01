import Net, {checkAuthRedirect, HashServerSelector} from './net'
import More from './more'
import writeToolbar from './toolbar'
import makeNetDialog from './net-dialog'
import {toUserQuery} from './osm'
import ChangesetStream from './changeset-stream'
import {installRelativeTimeListeners, makeDateOutputFromString} from './date'
import serverListConfig from './server-list-config'
import {makeElement, makeDiv, makeLabel, makeLink} from './util/html'
import {PrefixedLocalStorage} from './util/storage'
import {makeEscapeTag} from './util/escape'

const appName='osm-changeset-viewer'

const e=makeEscapeTag(encodeURIComponent)

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
	net.serverSelector.installHashChangeListener(net.cx,()=>{})
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
		$grid.append($form)
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
			more.changeToLoadMore()
			more.$button.onclick=async()=>{
				more.changeToLoading()
				const changesets=await stream.fetch()
				for (const changeset of changesets) {
					$grid.append(makeDiv('changeset')(
						makeLink(`${changeset.id}`,cx.server.web.getUrl(e`changeset/${changeset.id}`)),` `,
						makeDateOutputFromString(changeset.created_at),` `,
						changeset.tags?.comment ?? ''
					))
				}
				if (changesets.length==0) {
					more.changeToLoadedAll()
				} else {
					more.changeToLoadMore()
				}
			}
		}
		$content.append(
			makeElement('h2')()(`Select users and changesets`),
			$grid,
			more.$div
		)
	} else {
		$content.append(
			makeDiv('notice')(`Please select a valid server`)
		)
	}

	writeToolbar($root,$toolbar,$netDialog)
}
