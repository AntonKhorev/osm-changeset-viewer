declare global {
	interface HTMLElementEventMap {
		'osmChangesetViewer:itemHighlight': CustomEvent<{type:string,id:number}>
		'osmChangesetViewer:itemUnhighlight': Event
		'osmChangesetViewer:itemPing': CustomEvent<{type:string,id:number}>
	}
}
export {}
