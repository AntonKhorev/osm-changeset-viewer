declare global {
	interface HTMLElementEventMap {
		'osmChangesetViewer:itemHighlight': CustomEvent<{type:string,id:number}>
		'osmChangesetViewer:itemUnhighlight': CustomEvent<{type:string,id:number}>
		'osmChangesetViewer:itemPing': CustomEvent<{type:string,id:number}>
	}
}
export {}
