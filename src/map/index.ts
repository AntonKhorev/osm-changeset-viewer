import type {RenderView} from './layer'
import ItemLayer from './item-layer'
import {calculatePxSize, clamp} from './geo'
import type {ItemMapViewInfo} from '../grid'
import {makeDiv} from "../util/html"

const maxZoom=19

type Animation = {
	type: 'stopped'
} | {
	type: 'zooming'
	startTime: number
	startX: number
	startY: number
	startZ: number
	finishTime: number
	finishX: number
	finishY: number
	finishZ: number
	transformOriginPxX: number
	transformOriginPxY: number
}

export default class MapView {
	$mapView=makeDiv('map')()
	private requestId: number|undefined
	private readonly animateFrame:(time:number)=>void
	private animation: Animation = {type:'stopped'}
	private itemLayer=new ItemLayer()
	private viewX=0.5
	private viewY=0.5
	private viewZ=0
	constructor() {
		this.$mapView.append(this.itemLayer.$layer)
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
					this.itemLayer.$layer.style.transformOrigin=`${this.animation.transformOriginPxX}px ${this.animation.transformOriginPxY}px`
					this.itemLayer.$layer.style.scale=String(
						1*startWeight+
						2**(this.animation.finishZ-this.animation.startZ)*finishWeight
					)
				}
			}
			if (this.animation.type=='stopped') {
				this.itemLayer.$layer.removeAttribute('style')
				const renderView=this.makeRenderView()
				if (!renderView) {
					this.itemLayer.clear()
					return
				}
				this.itemLayer.render(renderView)
			} else {
				this.scheduleFrame()
			}
		}
		this.$mapView.onwheel=ev=>{
			if (this.animation.type=='zooming') return
			const viewPxSizeX=this.$mapView.clientWidth
			const viewPxSizeY=this.$mapView.clientHeight
			if (viewPxSizeX<=0 || viewPxSizeY<=0) return
			// const renderView=this.makeRenderView()
			// if (!renderView) return
			const dz=-Math.sign(ev.deltaY)
			const finishZ=clamp(0,this.viewZ+dz,maxZoom)
			if (finishZ==this.viewZ) return
			const dx=getViewCenterPxOffset(viewPxSizeX,ev.offsetX)
			const dy=getViewCenterPxOffset(viewPxSizeY,ev.offsetY)
			console.log('> zoom deltas',dz,dx,dy) ///
			// TODO correct finish coords
			const pxSize=calculatePxSize(this.viewZ)
			// const f=2**dz
			const f=2**(finishZ-this.viewZ)
			// const finishX=f*this.viewX+(f-1)*dx*pxSize
			// const finishY=f*this.viewY+(f-1)*dy*pxSize // TODO clamp
			// ---
			// const finishX=this.viewX+(f-1)*dx*pxSize
			// const finishY=this.viewY+(f-1)*dy*pxSize // TODO clamp
			// ---
			const finishX=(this.viewX/pxSize*f+(f-1)*dx)*calculatePxSize(finishZ)
			const finishY=(this.viewY/pxSize*f+(f-1)*dy)*calculatePxSize(finishZ) // TODO clamp
			// const [finishX,finishY]=this.getPositionFromRenderViewPxPosition(renderView,ev.offsetX,ev.offsetY)
			const time=performance.now()
			this.animation={
				type: 'zooming',
				startTime: time,
				startX: this.viewX,
				startY: this.viewY,
				startZ: this.viewZ,
				finishTime: time+300,
				finishX,finishY,finishZ,
				transformOriginPxX: ev.offsetX,
				transformOriginPxY: ev.offsetY
			}
			console.log('> start zoom anim',this.animation) ///
			this.scheduleFrame()
		}
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
		// const viewCenterPxOffsetX1=-viewPxSizeX/2-(viewPxSizeX&1)*.5
		const viewCenterPxOffsetX1=getViewCenterPxOffset(viewPxSizeX,0)
		// const viewCenterPxOffsetX2=+viewPxSizeX/2-(viewPxSizeX&1)*.5
		const viewCenterPxOffsetX2=getViewCenterPxOffset(viewPxSizeX,viewPxSizeX)
		// const viewCenterPxOffsetY1=-viewPxSizeY/2-(viewPxSizeY&1)*.5
		const viewCenterPxOffsetY1=getViewCenterPxOffset(viewPxSizeY,0)
		// const viewCenterPxOffsetY2=+viewPxSizeY/2-(viewPxSizeY&1)*.5
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
	// private getPositionFromRenderViewPxPosition(renderView: RenderView, pxX: number, pxY: number): [x: number, y: number] {
	// 	const pxSize=calculatePxSize(renderView.z)
	// 	const x=(renderView.pxX1+pxX)*pxSize
	// 	const y=(renderView.pxY1+pxY)*pxSize
	// 	return [x,clamp(0,y,1)]
	// }
}

function getViewCenterPxOffset(viewPxSize: number, viewCornerPxOffset: number): number {
	return viewCornerPxOffset-viewPxSize/2-(viewPxSize&1)*.5
}
