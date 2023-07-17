import type {ViewZoomPoint, RenderViewZoomBox} from './geo'
import {calculateXYUV, calculateUVXY, calculateLat, calculateLon} from './geo'
import type {Animation} from './animation'
import {makeFlingAnimation} from './animation'
import type {Layer} from './layer'
import {ItemLayer, TileLayer} from './layer'
import MapDragListener from './drag'
import {clamp} from '../math'
import type Colorizer from '../colorizer'
import type {TileProvider} from '../net'
import type {ItemMapViewInfo} from '../grid'
import {bubbleCustomEvent} from '../util/events'
import {makeDiv, makeLink} from '../util/html'

export default class MapWidget {
	$widget=makeDiv('map')()
	private requestId: number|undefined
	private readonly animateFrame:(time:number)=>void
	private animation: Animation = {type:'stopped'}
	private tileLayer: TileLayer
	private itemLayer=new ItemLayer()
	private view: ViewZoomPoint = { u: 0.5, v: 0.5, z: 0 }
	get layers(): Layer[] {
		return [this.tileLayer,this.itemLayer]
	}
	constructor(colorizer: Colorizer, tileProvider: TileProvider) {
		this.tileLayer=new TileLayer(tileProvider)
		const $attribution=makeDiv('attribution')(
			`© `,makeLink(tileProvider.attributionText,tileProvider.attributionUrl)
		)
		this.$widget.append(
			...this.layers.map(layer=>layer.$layer),
			$attribution
		)
		this.animateFrame=(time:number)=>{
			this.requestId=undefined
			if (this.animation.type=='zooming') {
				if (time>=this.animation.finishTime) {
					this.view.u=this.animation.finish.u-Math.floor(this.animation.finish.u)
					this.view.v=this.animation.finish.v
					this.view.z=this.animation.finish.z
					this.animation={type:'stopped'}
				} else {
					const finishWeight=(time-this.animation.startTime)/(this.animation.finishTime-this.animation.startTime)
					const startWeight=1-finishWeight
					this.view.u=this.animation.start.u*startWeight+this.animation.finish.u*finishWeight
					this.view.v=this.animation.start.v*startWeight+this.animation.finish.v*finishWeight
					this.view.z=this.animation.start.z*startWeight+this.animation.finish.z*finishWeight
					for (const layer of this.layers) {
						layer.$layer.style.transformOrigin=`${this.animation.transformOrigin.x}px ${this.animation.transformOrigin.y}px`
						layer.$layer.style.scale=String(
							1*startWeight+
							2**(this.animation.finish.z-this.animation.start.z)*finishWeight
						)
					}
				}
			} else if (this.animation.type=='panning') {
				const xyUV=calculateXYUV(this.view.z)
				const x=this.animation.xAxis.getPosition(time)
				const y=clamp(0,this.animation.yAxis.getPosition(time),1/xyUV)
				this.view.u=x*xyUV
				this.view.v=y*xyUV
				if (this.animation.xAxis.isEnded(time) && this.animation.yAxis.isEnded(time)) {
					this.animation={type:'stopped'}
				} else {
					const x0=this.animation.xAxis.startPosition
					const y0=this.animation.yAxis.startPosition
					for (const layer of this.layers) {
						layer.$layer.style.translate=`${x0-x}px ${y0-y}px`
					}
				}
			}
			if (this.animation.type=='stopped') {
				this.roundViewPosition(tileProvider.maxZoom)
				const renderViewBox=this.makeRenderViewBox()
				if (renderViewBox) {
					this.dispatchMoveEndEvent()
				}
				for (const layer of this.layers) {
					layer.$layer.removeAttribute('style')
				}
				if (!renderViewBox) {
					for (const layer of this.layers) {
						layer.clear()
					}
				} else {
					for (const layer of this.layers) {
						layer.render(renderViewBox,colorizer)
					}
				}
			} else {
				this.scheduleFrame()
			}
		}
		this.$widget.onwheel=ev=>{
			if (this.animation.type=='zooming') return
			const viewSizeX=this.$widget.clientWidth
			const viewSizeY=this.$widget.clientHeight
			if (viewSizeX<=0 || viewSizeY<=0) return
			let dz=-Math.sign(ev.deltaY)
			const finishZ=clamp(0,this.view.z+dz,tileProvider.maxZoom)
			dz=finishZ-this.view.z
			if (dz==0) return
			const dx=getViewCenterOffset(viewSizeX,ev.offsetX)
			const dy=getViewCenterOffset(viewSizeY,ev.offsetY)
			const xyUV=calculateXYUV(this.view.z)
			const time=performance.now()
			this.animation={
				type: 'zooming',
				startTime: time,
				start: {...this.view},
				finishTime: time+300,
				finish: {
					u: this.view.u+(1-.5**dz)*dx*xyUV,
					v: clamp(0,this.view.v+(1-.5**dz)*dy*xyUV,1),
					z: finishZ
				},
				transformOrigin: { x: ev.offsetX, y: ev.offsetY},
			}
			this.scheduleFrame()
		}
		new MapDragListener(this.$widget,()=>{
			if (this.animation.type!='stopped') return null
			const uvXY=calculateUVXY(this.view.z)
			return [
				this.view.u*uvXY,
				this.view.v*uvXY
			]
		},(x:number,y:number)=>{
			const xyUV=calculateXYUV(this.view.z)
			this.view.u=x*xyUV
			this.view.v=clamp(0,y*xyUV,1)
			this.scheduleFrame()
		},(speedX:number,speedY:number)=>{
			if (this.animation.type!='stopped') return
			const uvXY=calculateUVXY(this.view.z)
			this.animation=makeFlingAnimation(
				performance.now(),
				this.view.u*uvXY,this.view.v*uvXY,
				speedX,speedY
			)
			this.scheduleFrame()
		}).install()
		const resizeObserver=new ResizeObserver(()=>this.scheduleFrame())
		resizeObserver.observe(this.$widget)
	}
	reset(): void {
		this.itemLayer.removeAllItems()
		this.scheduleFrame()
	}
	redraw(): void {
		this.scheduleFrame()
	}
	addItem(item: ItemMapViewInfo): void {
		this.itemLayer.addItem(item)
		this.scheduleFrame()
	}
	highlightItem(type: string, id: number): void {
		this.itemLayer.highlightItem(type,id)
		this.scheduleFrame()
	}
	unhighlightItem(type: string, id: number): void {
		this.itemLayer.unhighlightItem(type,id)
		this.scheduleFrame()
	}
	private scheduleFrame(): void {
		if (this.requestId!=null) return
		this.requestId=requestAnimationFrame(this.animateFrame)
	}
	private makeRenderViewBox(): RenderViewZoomBox|null {
		const viewSizeX=this.$widget.clientWidth
		const viewSizeY=this.$widget.clientHeight
		if (viewSizeX<=0 || viewSizeY<=0) {
			return null
		}
		const viewCenterOffsetX1=getViewCenterOffset(viewSizeX,0)
		const viewCenterOffsetX2=getViewCenterOffset(viewSizeX,viewSizeX)
		const viewCenterOffsetY1=getViewCenterOffset(viewSizeY,0)
		const viewCenterOffsetY2=getViewCenterOffset(viewSizeY,viewSizeY)
		const uvXY=calculateUVXY(this.view.z)
		const renderView:RenderViewZoomBox={
			x1: this.view.u*uvXY+viewCenterOffsetX1,
			x2: this.view.u*uvXY+viewCenterOffsetX2,
			y1: this.view.v*uvXY+viewCenterOffsetY1,
			y2: this.view.v*uvXY+viewCenterOffsetY2,
			z: this.view.z
		}
		return renderView
	}
	private roundViewPosition(maxZoom: number): void {
		this.view.z=Math.round(clamp(0,this.view.z,maxZoom))
		const xyUV=calculateXYUV(this.view.z)
		this.view.u=Math.round(this.view.u/xyUV)*xyUV
		this.view.v=clamp(0,Math.round(this.view.v/xyUV)*xyUV,1)
	}
	private dispatchMoveEndEvent(): void {
		const precision=Math.max(0,Math.ceil(Math.log2(this.view.z)))
		bubbleCustomEvent(this.$widget,'osmChangesetViewer:mapMoveEnd',{
			zoom: this.view.z.toFixed(0),
			lat: calculateLat(this.view.v).toFixed(precision),
			lon: calculateLon(this.view.u).toFixed(precision),
		})
	}
}

function getViewCenterOffset(viewSize: number, viewCornerOffset: number): number {
	return viewCornerOffset-viewSize/2-(viewSize&1)*.5
}
