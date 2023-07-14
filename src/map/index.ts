import type {Animation} from './animation'
import {makeFlingAnimation} from './animation'
import type {RenderView, Layer} from './layer'
import {ItemLayer, TileLayer} from './layer'
import installDragListeners from './drag'
import {calculatePxSize, clamp} from './geo'
import type Colorizer from '../colorizer'
import type {TileProvider} from '../net'
import type {ItemMapViewInfo} from '../grid'
import {makeDiv} from "../util/html"

export default class MapView {
	$mapView=makeDiv('map')()
	private requestId: number|undefined
	private readonly animateFrame:(time:number)=>void
	private animation: Animation = {type:'stopped'}
	private tileLayer: TileLayer
	private itemLayer=new ItemLayer()
	private viewX=0.5
	private viewY=0.5
	private viewZ=0
	get layers(): Layer[] {
		return [this.tileLayer,this.itemLayer]
	}
	constructor(colorizer: Colorizer, tileProvider: TileProvider) {
		this.tileLayer=new TileLayer(tileProvider)
		this.$mapView.append(...this.layers.map(layer=>layer.$layer))
		this.animateFrame=(time:number)=>{
			this.requestId=undefined
			if (this.animation.type=='zooming') {
				if (time>=this.animation.finishTime) {
					this.viewX=this.animation.finishX-Math.floor(this.animation.finishX)
					this.viewY=this.animation.finishY
					this.viewZ=this.animation.finishZ
					this.animation={type:'stopped'}
				} else {
					const finishWeight=(time-this.animation.startTime)/(this.animation.finishTime-this.animation.startTime)
					const startWeight=1-finishWeight
					this.viewX=this.animation.startX*startWeight+this.animation.finishX*finishWeight
					this.viewY=this.animation.startY*startWeight+this.animation.finishY*finishWeight
					this.viewZ=this.animation.startZ*startWeight+this.animation.finishZ*finishWeight
					for (const layer of this.layers) {
						layer.$layer.style.transformOrigin=`${this.animation.transformOriginPxX}px ${this.animation.transformOriginPxY}px`
						layer.$layer.style.scale=String(
							1*startWeight+
							2**(this.animation.finishZ-this.animation.startZ)*finishWeight
						)
					}
				}
			} else if (this.animation.type=='panning') {
				const pxSize=calculatePxSize(this.viewZ)
				const pxX=this.animation.xAxis.getPosition(time)
				const pxY=this.animation.yAxis.getPosition(time)
				this.viewX=pxX*pxSize
				this.viewY=pxY*pxSize
				if (this.animation.xAxis.isEnded(time) && this.animation.yAxis.isEnded(time)) {
					this.animation={type:'stopped'}
				} else {
					const pxX0=this.animation.xAxis.startPosition
					const pxY0=this.animation.yAxis.startPosition
					for (const layer of this.layers) {
						layer.$layer.style.translate=`${pxX0-pxX}px ${pxY0-pxY}px`
					}
				}
			}
			if (this.animation.type=='stopped') {
				this.roundViewPosition(tileProvider.maxZoom)
				for (const layer of this.layers) {
					layer.$layer.removeAttribute('style')
				}
				const renderView=this.makeRenderView()
				if (!renderView) {
					for (const layer of this.layers) {
						layer.clear()
					}
				} else {
					for (const layer of this.layers) {
						layer.render(renderView,colorizer)
					}
				}
			} else {
				this.scheduleFrame()
			}
		}
		this.$mapView.onwheel=ev=>{
			if (this.animation.type=='zooming') return
			const viewPxSizeX=this.$mapView.clientWidth
			const viewPxSizeY=this.$mapView.clientHeight
			if (viewPxSizeX<=0 || viewPxSizeY<=0) return
			let dz=-Math.sign(ev.deltaY)
			const startZ=this.viewZ
			const finishZ=clamp(0,startZ+dz,tileProvider.maxZoom)
			dz=finishZ-startZ
			if (dz==0) return
			const startX=this.viewX
			const startY=this.viewY
			const dx=getViewCenterPxOffset(viewPxSizeX,ev.offsetX)
			const dy=getViewCenterPxOffset(viewPxSizeY,ev.offsetY)
			const pxSize=calculatePxSize(this.viewZ)
			let finishX=startX+(1-.5**dz)*dx*pxSize
			let finishY=startY+(1-.5**dz)*dy*pxSize
			finishY=clamp(0,finishY,1)
			const time=performance.now()
			this.animation={
				type: 'zooming',
				startTime: time,
				startX,startY,startZ,
				finishTime: time+300,
				finishX,finishY,finishZ,
				transformOriginPxX: ev.offsetX,
				transformOriginPxY: ev.offsetY
			}
			this.scheduleFrame()
		}
		installDragListeners(this.$mapView,()=>{
			if (this.animation.type!='stopped') return null
			const pxSize=calculatePxSize(this.viewZ)
			return [
				this.viewX/pxSize,
				this.viewY/pxSize
			]
		},(pxX:number,pxY:number)=>{
			const pxSize=calculatePxSize(this.viewZ)
			this.viewX=pxX*pxSize
			this.viewY=clamp(0,pxY*pxSize,1)
			this.scheduleFrame()
		},(speedPxX:number,speedPxY:number)=>{
			if (this.animation.type!='stopped') return
			const pxSize=calculatePxSize(this.viewZ)
			this.animation=makeFlingAnimation(
				performance.now(),
				this.viewX/pxSize,this.viewY/pxSize,
				speedPxX,speedPxY
			)
			this.scheduleFrame()
		})
		const resizeObserver=new ResizeObserver(()=>this.scheduleFrame())
		resizeObserver.observe(this.$mapView)
	}
	reset(): void {
		this.itemLayer.removeAllItems()
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
	private makeRenderView(): RenderView|null {
		const viewPxSizeX=this.$mapView.clientWidth
		const viewPxSizeY=this.$mapView.clientHeight
		if (viewPxSizeX<=0 || viewPxSizeY<=0) {
			return null
		}
		const viewCenterPxOffsetX1=getViewCenterPxOffset(viewPxSizeX,0)
		const viewCenterPxOffsetX2=getViewCenterPxOffset(viewPxSizeX,viewPxSizeX)
		const viewCenterPxOffsetY1=getViewCenterPxOffset(viewPxSizeY,0)
		const viewCenterPxOffsetY2=getViewCenterPxOffset(viewPxSizeY,viewPxSizeY)
		const pxSize=calculatePxSize(this.viewZ)
		const renderView:RenderView={
			pxX1: this.viewX/pxSize+viewCenterPxOffsetX1,
			pxX2: this.viewX/pxSize+viewCenterPxOffsetX2,
			pxY1: this.viewY/pxSize+viewCenterPxOffsetY1,
			pxY2: this.viewY/pxSize+viewCenterPxOffsetY2,
			z: this.viewZ
		}
		return renderView
	}
	private roundViewPosition(maxZoom: number): void {
		this.viewZ=Math.round(clamp(0,this.viewZ,maxZoom))
		const pxSize=calculatePxSize(this.viewZ)
		this.viewX=Math.round(this.viewX/pxSize)*pxSize
		this.viewY=Math.round(this.viewY/pxSize)*pxSize
	}
}

function getViewCenterPxOffset(viewPxSize: number, viewCornerPxOffset: number): number {
	return viewCornerPxOffset-viewPxSize/2-(viewPxSize&1)*.5
}
