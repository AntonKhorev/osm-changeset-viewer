import {makeElement, makeDiv} from './util/html'

main()

async function main() {
	const $root=makeDiv('ui')()
	document.body.append($root)

	$root.append(
		makeElement('h1')()(`Changeset viewer`)
	)
}
