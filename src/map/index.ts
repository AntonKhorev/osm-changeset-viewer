import type {ItemMapViewInfo} from '../grid'
import {makeDiv} from "../util/html"

export default class MapView {
	items=new Map<string,ItemMapViewInfo>()
	requestId: number|undefined
	$mapView=makeDiv('map')()
	private readonly animateFrame:(time:number)=>void
	constructor() {
		this.animateFrame=(time:number)=>{
			this.$mapView.replaceChildren()
			this.requestId=undefined
			const xs=this.$mapView.clientWidth
			const ys=this.$mapView.clientHeight
			if (xs<=0 || ys<=0) return
			const s=Math.min(xs,ys)
			const cellSize=4
			const cs=Math.floor(s/cellSize)
			if (cs<=0) return
			const cells=new Uint16Array(cs**2)
			let maxV=0
			for (const item of this.items.values()) {
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
				const cx1=clamp(0,cs*calculateX(minLon),cs-1)
				const cx2=clamp(0,cs*calculateX(maxLon),cs-1)
				const cy1=clamp(0,cs*calculateY(minLat),cs-1)
				const cy2=clamp(0,cs*calculateY(maxLat),cs-1)
				for (let cy=cy1;cy<=cy2;cy++) {
					for (let cx=cx1;cx<=cx2;cx++) {
						const v=cells[cx+cy*cs]+=1
						if (maxV<v) maxV=v
					}
				}
			}
			const $svg=makeSvgElement('svg')
			$svg.setAttributeNS(null,'width',String(cs*cellSize))
			$svg.setAttributeNS(null,'height',String(cs*cellSize))
			this.$mapView.append($svg)
		}
		const resizeObserver=new ResizeObserver(()=>this.scheduleFrame())
		resizeObserver.observe(this.$mapView)
	}
	reset(): void {
		this.items.clear()
		this.scheduleFrame()
	}
	addItem(item: ItemMapViewInfo): void {
		const key=item.type+':'+item.id
		this.items.set(key,item)
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

function makeSvgElement<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
	return document.createElementNS("http://www.w3.org/2000/svg",tag)
}
