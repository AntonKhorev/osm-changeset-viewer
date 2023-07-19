import type {ViewZoomPoint, RenderZoomBox, GeoBox} from './geo'
import {
	calculateXYUV, calculateUVXY, calculateU, calculateV,
	calculateLat, calculateLon,
	normalizeViewZoomPoint, tilePower
} from './geo'
import type {Animation} from './animation'
import {makeFlingAnimation} from './animation'
import type {Layer} from './layer'
import {ItemLayer, TileLayer, STENCIL_ID_MASK, STENCIL_CHANGESET_MASK, STENCIL_NOTE_MASK} from './layer'
import MapDragListener from './drag'
import {clamp} from '../math'
import type Colorizer from '../colorizer'
import type {TileProvider} from '../net'
import type {ItemMapViewInfo} from '../grid'
import {bubbleCustomEvent, bubbleEvent} from '../util/events'
import {makeDiv, makeLink} from '../util/html'

export default class MapWidget {
	$widget=makeDiv('map')()
	private requestId: number|undefined
	private readonly animateFrame:(time:number)=>void
	private animation: Animation = {type:'stopped'}
	private tileLayer: TileLayer
	private itemLayer=new ItemLayer()
	private view: ViewZoomPoint = { u: 0.5, v: 0.5, z: 0 }
	private stencils: BigUint64Array|undefined
	constructor(
		$root: HTMLElement,
		colorizer: Colorizer,
		tileProvider: TileProvider
	) {
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
				if (time>=this.animation.finish.time) {
					this.view=this.animation.finish
					this.animation={type:'stopped'}
				} else {
					const finishWeight=clamp(0,
						(time-this.animation.start.time)/(this.animation.finish.time-this.animation.start.time),
					1)
					const startWeight=1-finishWeight
					this.view.u=this.animation.start.u*startWeight+this.animation.finish.u*finishWeight
					this.view.v=this.animation.start.v*startWeight+this.animation.finish.v*finishWeight
					this.view.z=Math.round(this.animation.start.z*startWeight+this.animation.finish.z*finishWeight)
					this.scaleLayers(
						1*startWeight+2**(this.animation.finish.z-this.animation.start.z)*finishWeight,
						this.animation.transformOrigin.x,
						this.animation.transformOrigin.y
					)
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
					const x0=this.animation.dragStart.u/xyUV
					const y0=this.animation.dragStart.v/xyUV
					this.translateLayers(x0-x,y0-y)
				}
			}
			if (this.animation.type=='stopped') {
				this.view=normalizeViewZoomPoint(this.view,tileProvider.maxZoom)
				const renderViewBox=this.makeRenderViewBox()
				if (renderViewBox) {
					bubbleEvent(this.$widget,'osmChangesetViewer:mapMoveEnd')
				}
				this.removeLayerTransforms()
				if (!renderViewBox) {
					this.stencils=undefined
					for (const layer of this.layers) {
						layer.clear()
					}
				} else {
					const stencilLength=(renderViewBox.x2-renderViewBox.x1)*(renderViewBox.y2-renderViewBox.y1)
					if (!this.stencils || this.stencils.length!=stencilLength) {
						this.stencils=new BigUint64Array(stencilLength)
					} else {
						this.stencils.fill(0n)
					}
					for (const layer of this.layers) {
						layer.render(renderViewBox,this.stencils,colorizer)
					}
				}
			} else {
				this.scheduleFrame()
			}
		}
		this.$widget.onwheel=ev=>{
			if (this.animation.type!='stopped') return
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
			const du=Math.round((1-.5**dz)*dx)*xyUV
			const dv=Math.round((1-.5**dz)*dy)*xyUV
			const time=performance.now()
			this.animation={
				type: 'zooming',
				start: {...this.view, time},
				finish: {
					u: this.view.u+du,
					v: clamp(0,this.view.v+dv,1),
					z: finishZ,
					time: time+300
				},
				transformOrigin: { x: ev.offsetX, y: ev.offsetY},
			}
			this.scheduleFrame()
		}
		this.$widget.onmousemove=ev=>{
			if (this.animation.type!='stopped') return
			if (!this.stencils) return
			if (ev.target!=this.$widget) return
			const viewSizeX=this.$widget.clientWidth
			const stencil=this.stencils[ev.offsetX+ev.offsetY*viewSizeX]
			this.$widget.style.cursor=stencil?'pointer':'grab'
		}
		this.$widget.onclick=ev=>{
			if (this.animation.type!='stopped') return
			if (!this.stencils) return
			if (ev.target!=this.$widget) return
			const viewSizeX=this.$widget.clientWidth
			const stencil=this.stencils[ev.offsetX+ev.offsetY*viewSizeX]
			const id=Number(stencil&STENCIL_ID_MASK)
			let type: string
			if (stencil&STENCIL_CHANGESET_MASK) {
				type='changeset'
			} else if (stencil&STENCIL_NOTE_MASK) {
				type='note'
			} else {
				return
			}
			bubbleCustomEvent(this.$widget,'osmChangesetViewer:itemPing',{type,id})
		}
		new MapDragListener(this.$widget,()=>{
			if (this.animation.type!='stopped') return false
			this.animation={
				type: 'dragging',
				start: {...this.view}
			}
			return true
		},(dx:number,dy:number)=>{
			if (this.animation.type!='dragging') return
			const xyUV=calculateXYUV(this.view.z)
			this.view.u=this.animation.start.u+dx*xyUV
			this.view.v=this.animation.start.v+dy*xyUV
			this.translateLayers(-dx,-dy)
		},(speedX:number,speedY:number)=>{
			if (this.animation.type!='dragging') return
			const uvXY=calculateUVXY(this.view.z)
			this.animation=makeFlingAnimation(
				this.animation.start,
				performance.now(),
				this.view.u*uvXY,this.view.v*uvXY,
				speedX,speedY
			)
			this.scheduleFrame()
		}).install()
		const resizeObserver=new ResizeObserver(()=>this.scheduleFrame())
		resizeObserver.observe(this.$widget)
		$root.addEventListener('osmChangesetViewer:itemHighlight',({detail:{type,id}})=>{
			this.itemLayer.highlightedItem={type,id}
			this.scheduleFrame()
		})
		$root.addEventListener('osmChangesetViewer:itemUnhighlight',()=>{
			this.itemLayer.highlightedItem=undefined
			this.scheduleFrame()
		})
		$root.addEventListener('osmChangesetViewer:itemPing',ev=>{
			if (ev.target==this.$widget) return
			const {type,id}=ev.detail
			const bbox=this.itemLayer.getItemBbox(type,id)
			if (!bbox) return
			this.fitBox(bbox)
		})
	}
	get hashValue(): string {
		const precision=Math.max(0,Math.ceil(Math.log2(this.view.z)))
		const zoomString=this.view.z.toFixed(0)
		const latString=calculateLat(this.view.v).toFixed(precision)
		const lonString=calculateLon(this.view.u).toFixed(precision)
		return `${zoomString}/${latString}/${lonString}`
	}
	set hashValue(hashValue: string) {
		const [zoomString,latString,lonString]=hashValue.split('/')
		if (zoomString==null || latString==null || lonString==null) return
		const zoom=Number(zoomString)
		const lat=Number(latString)
		const lon=Number(lonString)
		if (!Number.isInteger(zoom) || !Number.isFinite(lat) || !Number.isFinite(lon)) return
		this.view={
			u: calculateU(lon),
			v: calculateV(lat),
			z: zoom
		}
		this.animation={type:'stopped'}
		this.scheduleFrame()
	}
	private get layers(): Layer[] {
		return [this.tileLayer,this.itemLayer]
	}
	reset(): void {
		this.itemLayer.highlightedItem=undefined
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
	private scheduleFrame(): void {
		if (this.requestId!=null) return
		this.requestId=requestAnimationFrame(this.animateFrame)
	}
	private makeRenderViewBox(): RenderZoomBox|null {
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
		const renderView:RenderZoomBox={
			x1: this.view.u*uvXY+viewCenterOffsetX1,
			x2: this.view.u*uvXY+viewCenterOffsetX2,
			y1: this.view.v*uvXY+viewCenterOffsetY1,
			y2: this.view.v*uvXY+viewCenterOffsetY2,
			z: this.view.z
		}
		return renderView
	}
	private translateLayers(dx: number, dy: number): void {
		for (const layer of this.layers) {
			layer.$layer.style.translate=`${dx}px ${dy}px`
		}
	}
	private scaleLayers(scale: number, originX: number, originY: number): void {
		for (const layer of this.layers) {
			layer.$layer.style.transformOrigin=`${originX}px ${originY}px`
			layer.$layer.style.scale=String(scale)
		}
	}
	private removeLayerTransforms(): void {
		for (const layer of this.layers) {
			layer.$layer.removeAttribute('style')
		}
	}
	private fitBox(box: GeoBox): void {
		const u1=calculateU(box.minLon)
		const u2=calculateU(box.maxLon)
		const v1=calculateV(box.maxLat)
		const v2=calculateV(box.minLat)
		const viewSizeX=this.$widget.clientWidth
		const viewSizeY=this.$widget.clientHeight
		if (viewSizeX==0 || viewSizeY==0) return
		const viewMarginXY=16
		let limitedViewSizeX=viewSizeX
		if (limitedViewSizeX>2*viewMarginXY) limitedViewSizeX-=2*viewMarginXY
		let limitedViewSizeY=viewSizeY
		if (limitedViewSizeY>2*viewMarginXY) limitedViewSizeY-=2*viewMarginXY
		const u=(u1+u2)/2
		const v=(v1+v2)/2
		const z=Math.min(
			Math.floor(
				Math.log2(limitedViewSizeX/(u2-u1))
			),
			Math.floor(
				Math.log2(limitedViewSizeY/(v2-v1))
			)
		)-tilePower
		this.view={u,v,z}
		this.animation={type:'stopped'}
		this.scheduleFrame()
	}
}

function getViewCenterOffset(viewSize: number, viewCornerOffset: number): number {
	return viewCornerOffset-viewSize/2-(viewSize&1)*.5
}
