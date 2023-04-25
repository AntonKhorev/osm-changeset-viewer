import {makeDiv, makeElement} from './util/html'

export default class More {
	$button=makeElement('button')()(`Load more`)
	$div=makeDiv('more')(this.$button)
	constructor() {
		this.changeToNothingToLoad()
	}
	changeToNothingToLoad() {
		this.$div.hidden=true
	}
	changeToLoad() {
		this.$div.hidden=false
		this.$button.disabled=false
		this.$button.textContent=`Load changesets`
	}
	changeToLoading() {
		this.$div.hidden=false
		this.$button.disabled=true
		this.$button.textContent=`Loading changesets...`
	}
	changeToLoadedAll() {
		this.$div.hidden=false
		this.$button.disabled=true
		this.$button.textContent=`Loaded all changesets`
	}
	changeToLoadMore() {
		this.$div.hidden=false
		this.$button.disabled=false
		this.$button.textContent=`Load more changesets`
	}
}
