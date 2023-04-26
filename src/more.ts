import {makeDiv, makeElement} from './util/html'

export default class More {
	$button=makeElement('button')()(`Load more`)
	$div=makeDiv('more')(this.$button)
	autoLoad=false
	intersectionObserver=new IntersectionObserver((entries)=>{
		if (entries.length==0) return
		if (!entries[0].isIntersecting) return
		this.$button.click()
	})
	constructor() {
		this.changeToNothingToLoad()
	}
	changeToNothingToLoad() {
		this.intersectionObserver.disconnect()
		this.$div.hidden=true
	}
	changeToLoad() {
		this.intersectionObserver.disconnect()
		this.$div.hidden=false
		this.$button.disabled=false
		this.$button.textContent=`Load changesets`
	}
	changeToLoading() {
		this.intersectionObserver.disconnect()
		this.$div.hidden=false
		this.$button.disabled=true
		this.$button.textContent=`Loading changesets...`
	}
	changeToLoadedAll() {
		this.intersectionObserver.disconnect()
		this.$div.hidden=false
		this.$button.disabled=true
		this.$button.textContent=`Loaded all changesets`
	}
	changeToLoadMore() {
		if (this.autoLoad) {
			this.intersectionObserver.observe(this.$button)
		}
		this.$div.hidden=false
		this.$button.disabled=false
		this.$button.textContent=`Load more changesets`
	}
}
