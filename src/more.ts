import {makeDiv, makeElement} from './util/html'

export default class More {
	$button=makeElement('button')()(`Load more`)
	$div=makeDiv('major-input-group')(this.$button)
	constructor() {
		this.$div.hidden=true
	}
	changeToLoading() {
		this.$div.hidden=false
		this.$button.disabled=true
		this.$button.textContent=`Loading...`
	}
	changeToLoadedAll() {
		this.$div.hidden=false
		this.$button.disabled=true
		this.$button.textContent=`Loaded all changesets`
	}
	changeToLoadMore() {
		this.$div.hidden=false
		this.$button.disabled=false
		this.$button.textContent=`Load more`
	}
}
