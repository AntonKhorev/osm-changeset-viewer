import ItemLayer from './item-layer'
import {calculatePxSize} from './geo'
import type {ItemMapViewInfo} from '../grid'
import {makeDiv} from "../util/html"

export default class MapView {
	$mapView=makeDiv('map')()
	private requestId: number|undefined
	private readonly animateFrame:(time:number)=>void
	// private animationState: 'stopped' | 'panning' | 'zooming'
	private itemLayer=new ItemLayer()
	private viewCenterX=0.5
	private viewCenterY=0.5
	private viewZoom=0
	constructor() {
		this.animateFrame=(time:number)=>{
			this.$mapView.replaceChildren()
			this.requestId=undefined
			const viewPxSizeX=this.$mapView.clientWidth
			const viewPxSizeY=this.$mapView.clientHeight
			if (viewPxSizeX<=0 || viewPxSizeY<=0) return
			let viewPxOffsetX1=-viewPxSizeX/2-(viewPxSizeX&1)*.5
			let viewPxOffsetX2=+viewPxSizeX/2-(viewPxSizeX&1)*.5
			let viewPxOffsetY1=-viewPxSizeY/2-(viewPxSizeY&1)*.5
			let viewPxOffsetY2=+viewPxSizeY/2-(viewPxSizeY&1)*.5
			const pxSize=calculatePxSize(this.viewZoom)
			const $dataLayer=this.itemLayer.render(
				this.viewCenterX/pxSize+viewPxOffsetX1,
				this.viewCenterX/pxSize+viewPxOffsetX2,
				this.viewCenterY/pxSize+viewPxOffsetY1,
				this.viewCenterY/pxSize+viewPxOffsetY2,
				this.viewZoom
			)
			if ($dataLayer) this.$mapView.append($dataLayer)
		}
		const resizeObserver=new ResizeObserver(()=>this.scheduleFrame())
		resizeObserver.observe(this.$mapView)
	}
	reset(): void {
		this.itemLayer.reset()
		this.scheduleFrame()
	}
	addItem(item: ItemMapViewInfo): void {
		this.itemLayer.addItem(item)
		this.scheduleFrame()
	}
	private scheduleFrame(): void {
		if (this.requestId!=null) return
		this.requestId=requestAnimationFrame(this.animateFrame)
	}
}
