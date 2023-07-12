import {calculatePxSize, calculateX, calculateY} from './geo'
import type {ItemMapViewInfo} from '../grid'
import {getHueFromUid} from '../colorizer'

export default class ItemsLayer {
	private items=new Map<string,ItemMapViewInfo>()
	private subcells=new Map<number,[number,number]>
	private nSubcellsX=2
	private nSubcellsY=1
	private iSubcellX=1
	private iSubcellY=1
	reset(): void {
		this.items.clear()
		this.subcells.clear()
		this.nSubcellsX=2
		this.nSubcellsY=1
		this.iSubcellX=this.iSubcellY=1
	}
	addItem(item: ItemMapViewInfo): void {
		const key=item.type+':'+item.id
		this.items.set(key,item)
		if (!this.subcells.has(item.uid)) {
			if (this.nSubcellsY<this.nSubcellsX) {
				if (this.iSubcellY>=this.nSubcellsY) {
					this.nSubcellsY*=2
					this.iSubcellX=1
				}
			} else {
				if (this.iSubcellX>=this.nSubcellsX) {
					this.nSubcellsX*=2
					this.iSubcellY=1
				}
			}
			this.subcells.set(item.uid,[this.iSubcellX,this.iSubcellY])
			if (this.nSubcellsY<this.nSubcellsX) {
				if (++this.iSubcellX>=this.nSubcellsX) {
					this.iSubcellX=this.nSubcellsX/2
					this.iSubcellY++
				}
			} else {
				if (++this.iSubcellY>=this.nSubcellsY) {
					this.iSubcellY=this.nSubcellsY/2
					this.iSubcellX++
				}
			}
		}
	}
	render(
		viewPxX1: number,
		viewPxX2: number,
		viewPxY1: number,
		viewPxY2: number,
		viewZoom: number
	): Element|undefined {
		const pxSize=calculatePxSize(viewZoom)
		const repeatX1=Math.floor(viewPxX1*pxSize)
		const repeatX2=Math.floor(viewPxX2*pxSize)
		if (this.items.size<=0 || this.subcells.size<=0) return
		const subcellPxSize=2
		const cellPxSizeX=this.nSubcellsX*subcellPxSize
		const cellPxSizeY=this.nSubcellsY*subcellPxSize
		const viewCellX1=Math.floor(viewPxX1/cellPxSizeX)
		const viewCellX2=Math.ceil(viewPxX2/cellPxSizeX)
		const viewCellY1=Math.floor(viewPxY1/cellPxSizeY)
		const viewCellY2=Math.ceil(viewPxY2/cellPxSizeY)
		const nCellsX=viewCellX2-viewCellX1+1
		const nCellsY=viewCellY2-viewCellY1+1
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
			for (let repeatX=repeatX1;repeatX<=repeatX2;repeatX++) {
				const cx1=Math.floor((calculateX(minLon)+repeatX)/(cellPxSizeX*pxSize))
				const cx2=Math.floor((calculateX(maxLon)+repeatX)/(cellPxSizeX*pxSize))
				const cy1=Math.floor(calculateY(minLon)/(cellPxSizeY*pxSize))
				const cy2=Math.floor(calculateY(maxLon)/(cellPxSizeY*pxSize))
				for (let cy=Math.max(cy1,viewCellY1);cy<=Math.min(cy2,viewCellY2);cy++) {
					for (let cx=Math.max(cx1,viewCellX1);cx<=Math.min(cx2,viewCellX2);cx++) {
						const v=userCells[(cx-viewCellX1)+(cy-viewCellY1)*nCellsX]+=1
						if (maxV<v) maxV=v
					}
				}
			}
		}
		const $svg=makeSvgElement('svg',{width:String(viewPxX2-viewPxX1),height:String(viewPxY2-viewPxY1)})
		for (let icy=0;icy<nCellsY;icy++) {
			for (let icx=0;icx<nCellsX;icx++) {
				const cellPxX=(icx+viewCellX1)*cellPxSizeX-viewPxX1
				const cellPxY=(icy+viewCellY1)*cellPxSizeY-viewPxY1
				for (const [uid,[scx,scy]] of this.subcells) {
					const userCells=cells.get(uid)
					if (!userCells) continue
					const v=userCells[icx+icy*nCellsX]
					if (v<=0) continue
					$svg.append(makeSvgElement('rect',{
						width: String(subcellPxSize),
						height: String(subcellPxSize),
						x: String(cellPxX+scx*subcellPxSize+subcellPxSize/2),
						y: String(cellPxY+scy*subcellPxSize+subcellPxSize/2),
						fill: `hsl(${getHueFromUid(uid)} 80% 50%)`,
						opacity: String(.5+.5*v/maxV)
					}))
				}
			}
		}
		return $svg
	}
}

function makeSvgElement<K extends keyof SVGElementTagNameMap>(tag: K, attrs: {[name:string]:string}): SVGElementTagNameMap[K] {
	const $e=document.createElementNS("http://www.w3.org/2000/svg",tag)
	for (const name in attrs) {
		$e.setAttributeNS(null,name,attrs[name])
	}
	return $e
}
