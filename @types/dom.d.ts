declare global {
	interface HTMLElementEventMap {
		'osmChangesetViewer:mapMoveEnd': CustomEvent<{zoom: string, lat: string, lon: string}>
	}
}
export {}
