import type {ItemMapViewInfo} from '../grid'
import {getHueFromUid} from '../colorizer'
import {makeDiv} from "../util/html"

export default class MapView {
	$mapView=makeDiv('map')()
	private items=new Map<string,ItemMapViewInfo>()
	private subcells=new Map<number,[number,number]>
	private subcellSizeX=1
	private subcellSizeY=0
	private subcellFillIndex=0
	private requestId: number|undefined
	private readonly animateFrame:(time:number)=>void
	constructor() {
		this.animateFrame=(time:number)=>{
			this.$mapView.replaceChildren()
			this.requestId=undefined
			const mapViewPxSizeX=this.$mapView.clientWidth
			const mapViewPxSizeY=this.$mapView.clientHeight
			if (mapViewPxSizeX<=0 || mapViewPxSizeY<=0) return
			const mapViewMaxPxSize=Math.min(mapViewPxSizeX,mapViewPxSizeY)
			if (this.items.size<=0 || this.subcells.size<=0) return
			const subcellPxSize=3
			const cellPxSizeX=this.subcellSizeX*subcellPxSize+1
			const cellPxSizeY=this.subcellSizeY*subcellPxSize+1
			const nCellsX=Math.floor(mapViewMaxPxSize/cellPxSizeX)
			const nCellsY=Math.floor(mapViewMaxPxSize/cellPxSizeY)
			if (nCellsX<=0 || nCellsY<=0) return
			const cells=new Map<number,Uint16Array>(
				[...this.subcells.keys()].map(uid=>[uid,new Uint16Array(nCellsX*nCellsY)])
			)
			let maxV=0
			for (const item of this.items.values()) {
				const userCells=cells.get(item.uid)
				if (!userCells) continue
				let minLat: number
				let minLon: number
				let maxLat: number
				let maxLon: number
				if (item.type=='changeset') {
					;({minLat,minLon,maxLat,maxLon}=item)
				} else {
					minLat=maxLat=item.lat
					minLon=maxLon=item.lon
				}
				const cx1=clamp(0,Math.floor(nCellsX*calculateX(minLon)),nCellsX-1)
				const cx2=clamp(0,Math.floor(nCellsX*calculateX(maxLon)),nCellsX-1)
				const cy1=clamp(0,Math.floor(nCellsY*calculateY(minLat)),nCellsY-1)
				const cy2=clamp(0,Math.floor(nCellsY*calculateY(maxLat)),nCellsY-1)
				for (let cy=cy1;cy<=cy2;cy++) {
					for (let cx=cx1;cx<=cx2;cx++) {
						const v=userCells[cx+cy*nCellsX]+=1
						if (maxV<v) maxV=v
					}
				}
			}
			const $svg=makeSvgElement('svg',{width:String(nCellsX*cellPxSizeX),height:String(nCellsY*cellPxSizeY)})
			for (let cy=0;cy<nCellsY;cy++) {
				for (let cx=0;cx<nCellsX;cx++) {
					for (const [uid,[scx,scy]] of this.subcells) {
						const userCells=cells.get(uid)
						if (!userCells) continue
						const v=userCells[cx+cy*nCellsX]
						if (v<=0) continue
						$svg.append(makeSvgElement('rect',{
							width: String(subcellPxSize),
							height: String(subcellPxSize),
							x: String(cx*cellPxSizeX+scx*subcellPxSize),
							y: String(cy*cellPxSizeY+scy*subcellPxSize),
							fill: `hsl(${getHueFromUid(uid)} 80% 50%)`,
							opacity: String(v/maxV)
						}))
					}
				}
			}
			this.$mapView.append($svg)
		}
		const resizeObserver=new ResizeObserver(()=>this.scheduleFrame())
		resizeObserver.observe(this.$mapView)
	}
	reset(): void {
		this.items.clear()
		this.subcells.clear()
		this.subcellSizeX=1
		this.subcellSizeY=0
		this.subcellFillIndex=0
		this.scheduleFrame()
	}
	addItem(item: ItemMapViewInfo): void {
		const key=item.type+':'+item.id
		this.items.set(key,item)
		if (!this.subcells.has(item.uid)) {
			if (this.subcellSizeY<this.subcellSizeX) {
				if (this.subcellFillIndex>=this.subcellSizeY) {
					this.subcellSizeY++
					this.subcellFillIndex=0
				}
			} else {
				if (this.subcellFillIndex>=this.subcellSizeX) {
					this.subcellSizeX++
					this.subcellFillIndex=0
				}
			}
			if (this.subcellSizeY<this.subcellSizeX) {
				this.subcells.set(item.uid,[this.subcellSizeX-1,this.subcellFillIndex++])
			} else {
				this.subcells.set(item.uid,[this.subcellFillIndex++,this.subcellSizeY-1])
			}
		}
		this.scheduleFrame()
	}
	private scheduleFrame(): void {
		if (this.requestId!=null) return
		this.requestId=requestAnimationFrame(this.animateFrame)
	}
}

function calculateX(lon: number): number {
	return (lon+180)/360
}

function calculateY(lat: number): number {
	const maxLat=85.0511287798
	const validLatRadians=clamp(-maxLat,lat,maxLat)*Math.PI/180
	return (1-Math.log(Math.tan(validLatRadians) + 1/Math.cos(validLatRadians))/Math.PI)/2
}

function clamp(v1: number, v: number, v2: number): number {
	return Math.min(Math.max(v1,v),v2)
}

function makeSvgElement<K extends keyof SVGElementTagNameMap>(tag: K, attrs: {[name:string]:string}): SVGElementTagNameMap[K] {
	const $e=document.createElementNS("http://www.w3.org/2000/svg",tag)
	for (const name in attrs) {
		$e.setAttributeNS(null,name,attrs[name])
	}
	return $e
}
