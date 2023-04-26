import {makeDiv, makeElement} from './util/html'

export default class More {
	$button=makeElement('button')()(`Load more`)
	$div=makeDiv('more')(this.$button)
	#autoLoad=false
	private inLoadMoreState=false
	intersectionObserver=new IntersectionObserver((entries)=>{
		if (entries.length==0) return
		if (!entries[0].isIntersecting) return
		this.$button.click()
	})
	constructor() {
		this.changeToNothingToLoad()
	}
	get autoLoad(): boolean {
		return this.#autoLoad
	}
	set autoLoad(value: boolean) {
		this.#autoLoad=value
		this.updateIntersectionObserver()
	}
	changeToNothingToLoad(): void {
		this.inLoadMoreState=false
		this.updateIntersectionObserver()
		this.$div.hidden=true
	}
	changeToLoad(): void {
		this.inLoadMoreState=false
		this.updateIntersectionObserver()
		this.$div.hidden=false
		this.$button.disabled=false
		this.$button.textContent=`Load changesets`
	}
	changeToLoading(): void {
		this.inLoadMoreState=false
		this.updateIntersectionObserver()
		this.$div.hidden=false
		this.$button.disabled=true
		this.$button.textContent=`Loading changesets...`
	}
	changeToLoadedAll(): void {
		this.inLoadMoreState=false
		this.updateIntersectionObserver()
		this.$div.hidden=false
		this.$button.disabled=true
		this.$button.textContent=`Loaded all changesets`
	}
	changeToLoadMore(): void {
		this.inLoadMoreState=true
		this.updateIntersectionObserver()
		this.$div.hidden=false
		this.$button.disabled=false
		this.$button.textContent=`Load more changesets`
	}
	private updateIntersectionObserver(): void {
		if (this.inLoadMoreState && this.autoLoad) {
			this.intersectionObserver.observe(this.$button)
		} else {
			this.intersectionObserver.disconnect()
		}
	}
}
