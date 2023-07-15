export default abstract class DragListener<Grab extends {pointerId:number}> {
	protected cursorHovering='grab'
	protected cursorGrabbing='grabbing'
	protected grab: Grab | undefined
	constructor(
		protected $target: HTMLElement
	) {}
	install(): void {
		this.$target.style.touchAction='none'
		this.$target.style.cursor=this.cursorHovering
		this.$target.onpointerdown=ev=>{
			if (this.grab) return
			this.grab=this.beginDrag(ev)
			if (!this.grab) return
			this.$target.setPointerCapture(ev.pointerId)
			this.$target.style.cursor=this.cursorGrabbing
			this.$target.focus()
			ev.preventDefault()
		}
		this.$target.onpointermove=ev=>{
			if (!this.grab || this.grab.pointerId!=ev.pointerId) return
			this.doDrag(ev,this.grab)
			ev.preventDefault()
		}
		this.$target.onpointerup=ev=>{
			if (!this.grab || this.grab.pointerId!=ev.pointerId) return
			this.applyDrag(ev,this.grab)
			this.endDrag(ev,this.grab)
			this.grab=undefined
			this.$target.style.cursor=this.cursorHovering
			ev.preventDefault()
		}
		this.$target.onpointercancel=ev=>{
			if (!this.grab || this.grab.pointerId!=ev.pointerId) return
			this.endDrag(ev,this.grab)
			this.grab=undefined
			this.$target.style.cursor=this.cursorHovering
			ev.preventDefault()
		}
	}
	abstract beginDrag(ev: PointerEvent): Grab|undefined
	doDrag(ev: PointerEvent, grab: Grab): void {}
	applyDrag(ev: PointerEvent, grab: Grab): void {}
	endDrag(ev: PointerEvent, grab: Grab): void {}
}
