export default function installDragListeners<Grab extends {pointerId:number}>(
	$e: HTMLElement,
	startDrag: (ev:PointerEvent)=>Grab|undefined,
	doDrag: (ev:PointerEvent,grab:Grab)=>void,
	endDrag: (ev:PointerEvent,grab:Grab)=>void,
	cancelDrag?: (ev:PointerEvent,grab:Grab)=>void
): void {
	let grab: Grab | undefined
	$e.style.touchAction='none'
	$e.style.cursor='grab'
	$e.onpointerdown=ev=>{
		if (grab) return
		grab=startDrag(ev)
		if (!grab) return
		$e.setPointerCapture(ev.pointerId)
		$e.style.cursor='grabbing'
		ev.preventDefault()
	}
	$e.onpointermove=ev=>{
		if (!grab || grab.pointerId!=ev.pointerId) return
		doDrag(ev,grab)
		ev.preventDefault()
	}
	$e.onpointerup=$e.onpointercancel=ev=>{
		if (!grab || grab.pointerId!=ev.pointerId) return
		endDrag(ev,grab)
		grab=undefined
		$e.style.cursor='grab'
		ev.preventDefault()
	}
	if (cancelDrag) $e.onpointercancel=ev=>{
		if (!grab || grab.pointerId!=ev.pointerId) return
		cancelDrag(ev,grab)
		grab=undefined
		$e.style.cursor='grab'
		ev.preventDefault()
	}
}
