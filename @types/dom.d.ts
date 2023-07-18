declare global {
	interface HTMLElementEventMap {
		'osmChangesetViewer:itemPing': CustomEvent<{type:string,id:number}>
	}
}
export {}
