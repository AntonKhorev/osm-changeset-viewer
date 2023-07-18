import Layer from './base'
import type {RenderViewBox, RenderViewZoomBox, GeoBox} from '../geo'
import {calculateXYUV, calculateU, calculateV} from '../geo'
import {clamp} from '../../math'
import type {ItemMapViewInfo} from '../../grid'
import type Colorizer from '../../colorizer'
import {makeElement} from '../../util/html'

const TOP=1
const RIGHT=2
const BOTTOM=4
const LEFT=8

const bboxThreshold=16
const bboxThickness=2
const highlightStroke='blue'
const highlightBoxThickness=1

export default class ItemLayer extends Layer {
	private items=new Map<string,ItemMapViewInfo>()
	private highlightedItems=new Set<string>()
	private subcells=new Map<number,[number,number]>
	private nSubcellsX=2
	private nSubcellsY=1
	private iSubcellX=1
	private iSubcellY=1
	private $canvas=makeElement('canvas')()()
	private $bboxSvg=makeSvgElement('svg')
	private $highlightBboxSvg=makeSvgElement('svg')
	private ctx=this.$canvas.getContext('2d')
	constructor() {
		super()
		this.$layer.append(this.$canvas)
	}
	removeAllItems(): void {
		this.items.clear()
		this.highlightedItems.clear()
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
	getItemBbox(type: string, id: number): GeoBox|null {
		const key=type+':'+id
		const item=this.items.get(key)
		if (!item) return null
		return this.getItemBboxFromInfo(item)
	}
	private getItemBboxFromInfo(item: ItemMapViewInfo): GeoBox {
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
		return {minLat,minLon,maxLat,maxLon}
	}
	highlightItem(type: string, id: number): void {
		const key=type+':'+id
		this.highlightedItems.add(key)
	}
	unhighlightItem(type: string, id: number): void {
		const key=type+':'+id
		this.highlightedItems.delete(key)
	}
	clear(): void {
		if (!this.ctx) return
		this.ctx.clearRect(0,0,this.$canvas.width,this.$canvas.height)
		this.$bboxSvg.replaceChildren()
		this.$highlightBboxSvg.replaceChildren()
	}
	render(viewBox: RenderViewZoomBox, colorizer: Colorizer): void {
		if (!this.ctx) return
		const getCellFillStyle=(globalMaxCellWeight:number,cellWeight:number,uid:number)=>
			`hsl(${colorizer.getHueForUid(uid)} 80% 50% / ${.5+.4*cellWeight/globalMaxCellWeight})`

		this.$canvas.width=viewBox.x2-viewBox.x1
		this.$canvas.height=viewBox.y2-viewBox.y1
		this.clear()
		const xyUV=calculateXYUV(viewBox.z)
		const repeatU1=Math.floor(viewBox.x1*xyUV)
		const repeatU2=Math.floor(viewBox.x2*xyUV)
		if (this.items.size<=0 || this.subcells.size<=0) return
		const subcellSizeXY=2
		const cellSizeX=this.nSubcellsX*subcellSizeXY
		const cellSizeY=this.nSubcellsY*subcellSizeXY
		const viewCellX1=Math.floor(viewBox.x1/cellSizeX)
		const viewCellX2=Math.ceil(viewBox.x2/cellSizeX)
		const viewCellY1=Math.floor(viewBox.y1/cellSizeY)
		const viewCellY2=Math.ceil(viewBox.y2/cellSizeY)
		const nCellsX=viewCellX2-viewCellX1+1
		const nCellsY=viewCellY2-viewCellY1+1
		if (nCellsX<=0 || nCellsY<=0) return
		const cells=new Map<number,Float32Array>(
			[...this.subcells.keys()].map(uid=>[uid,new Float32Array(nCellsX*nCellsY)])
		)
		const cellBorders=new Uint8Array(nCellsX*nCellsY)
		let globalMaxCellWeight=0
		for (const item of this.items.values()) {
			const key=item.type+':'+item.id
			const highlighted=this.highlightedItems.has(key)
			const userCells=cells.get(item.uid)
			if (!userCells) continue
			const bbox=this.getItemBboxFromInfo(item)
			for (let repeatU=repeatU1;repeatU<=repeatU2;repeatU++) {
				const itemX1=(calculateU(bbox.minLon)+repeatU)/xyUV
				const itemX2=(calculateU(bbox.maxLon)+repeatU)/xyUV
				const itemY1= calculateV(bbox.maxLat)/xyUV
				const itemY2= calculateV(bbox.minLat)/xyUV
				if (itemX2-itemX1>bboxThreshold && itemY2-itemY1>bboxThreshold) {
					this.renderBbox(
						viewBox,this.$bboxSvg,
						getCellFillStyle(1,0.7,item.uid),bboxThickness, // TODO use weight in stroke
						Math.round(itemX1),Math.round(itemX2),
						Math.round(itemY1),Math.round(itemY2)
					)
					if (highlighted) this.renderBbox(
						viewBox,this.$highlightBboxSvg,
						highlightStroke,highlightBoxThickness,
						Math.round(itemX1),Math.round(itemX2),
						Math.round(itemY1),Math.round(itemY2)
					)
				} else {
					const itemCellX1=Math.floor(itemX1/cellSizeX)
					const itemCellX2=Math.floor(itemX2/cellSizeX)
					const itemCellY1=Math.floor(itemY1/cellSizeY)
					const itemCellY2=Math.floor(itemY2/cellSizeY)
					const weightPerCell=item.weight/((itemCellX2-itemCellX1+1)*(itemCellY2-itemCellY1+1))
					for (let cy=Math.max(itemCellY1,viewCellY1);cy<=Math.min(itemCellY2,viewCellY2);cy++) {
						for (let cx=Math.max(itemCellX1,viewCellX1);cx<=Math.min(itemCellX2,viewCellX2);cx++) {
							const idx=(cx-viewCellX1)+(cy-viewCellY1)*nCellsX
							const cellWeight=userCells[idx]+=weightPerCell
							if (globalMaxCellWeight<cellWeight) globalMaxCellWeight=cellWeight
							if (highlighted) {
								if (cy==itemCellY1) cellBorders[idx]|=TOP
								if (cy==itemCellY2) cellBorders[idx]|=BOTTOM
								if (cx==itemCellX1) cellBorders[idx]|=LEFT
								if (cx==itemCellX2) cellBorders[idx]|=RIGHT
							}
						}
					}
				}
			}
		}
		this.addOrRemoveSvg(viewBox,this.$bboxSvg)
		this.addOrRemoveSvg(viewBox,this.$highlightBboxSvg)
		for (let icy=0;icy<nCellsY;icy++) {
			for (let icx=0;icx<nCellsX;icx++) {
				const cellX=(icx+viewCellX1)*cellSizeX-viewBox.x1
				const cellY=(icy+viewCellY1)*cellSizeY-viewBox.y1
				let maxCellWeightUid:number|undefined
				let maxCellWeight=0
				for (const [uid] of this.subcells) {
					const userCells=cells.get(uid)
					if (!userCells) continue
					const cellWeight=userCells[icx+icy*nCellsX]
					if (cellWeight>maxCellWeight) {
						maxCellWeight=cellWeight
						maxCellWeightUid=uid
					}
				}
				if (maxCellWeightUid==null) continue
				{
					const userCells=cells.get(maxCellWeightUid)
					if (!userCells) continue
					this.ctx.fillStyle=getCellFillStyle(globalMaxCellWeight,maxCellWeight,maxCellWeightUid)
					this.ctx.fillRect(cellX,cellY,cellSizeX,cellSizeY)
				}
				for (const [uid,[scx,scy]] of this.subcells) {
					if (uid==maxCellWeightUid) continue
					const userCells=cells.get(uid)
					if (!userCells) continue
					const cellWeight=userCells[icx+icy*nCellsX]
					if (cellWeight<=0) continue
					const subcellX=cellX+scx*subcellSizeXY-subcellSizeXY/2
					const subcellY=cellY+scy*subcellSizeXY-subcellSizeXY/2
					this.ctx.fillStyle=getCellFillStyle(globalMaxCellWeight,cellWeight,uid)
					this.ctx.clearRect(subcellX,subcellY,subcellSizeXY,subcellSizeXY)
					this.ctx.fillRect(subcellX,subcellY,subcellSizeXY,subcellSizeXY)
				}
			}
		}
		this.ctx.strokeStyle=highlightStroke
		for (let icy=0;icy<nCellsY;icy++) {
			for (let icx=0;icx<nCellsX;icx++) {
				const cellX=(icx+viewCellX1)*cellSizeX-viewBox.x1
				const cellY=(icy+viewCellY1)*cellSizeY-viewBox.y1
				const borders=cellBorders[icx+icy*nCellsX]
				if (borders) this.ctx.beginPath()
				if (borders&TOP) {
					this.ctx.moveTo(cellX,cellY+.5)
					this.ctx.lineTo(cellX+cellSizeX,cellY+.5)
				}
				if (borders&BOTTOM) {
					this.ctx.moveTo(cellX,cellY+cellSizeY-.5)
					this.ctx.lineTo(cellX+cellSizeX,cellY+cellSizeY-.5)
				}
				if (borders&LEFT) {
					this.ctx.moveTo(cellX+.5,cellY)
					this.ctx.lineTo(cellX+.5,cellY+cellSizeY)
				}
				if (borders&RIGHT) {
					this.ctx.moveTo(cellX+cellSizeX-.5,cellY)
					this.ctx.lineTo(cellX+cellSizeX-.5,cellY+cellSizeY)
				}
				if (borders) this.ctx.stroke()
			}
		}
	}
	private renderBbox(
		viewBox: RenderViewBox, $svg: SVGSVGElement,
		stroke: string, strokeWidth: number,
		itemX1: number, itemX2: number,
		itemY1: number, itemY2: number
	): void {
		const edgeX1=viewBox.x1-bboxThickness
		const edgeY1=viewBox.y1-bboxThickness
		const edgeX2=viewBox.x2-1+bboxThickness
		const edgeY2=viewBox.y2-1+bboxThickness
		const bboxX1=clamp(edgeX1,itemX1,edgeX2)
		const bboxX2=clamp(edgeX1,itemX2,edgeX2)
		const bboxY1=clamp(edgeY1,itemY1,edgeY2)
		const bboxY2=clamp(edgeY1,itemY2,edgeY2)
		const drawLineXY=(
			x1: number, x2: number,
			y1: number, y2: number
		)=>{
			$svg.append(makeSvgElement('line',{
				x1: String(x1-viewBox.x1),
				x2: String(x2-viewBox.x1),
				y1: String(y1-viewBox.y1),
				y2: String(y2-viewBox.y1),
				stroke,
				'stroke-width': String(strokeWidth),
			}))
		}
		const drawLineX=(lineX: number)=>{
			if (
				lineX>=viewBox.x1-bboxThickness/2 &&
				lineX<viewBox.x2+bboxThickness/2 &&
				bboxY1<bboxY2
			) drawLineXY(lineX,lineX,bboxY1,bboxY2)
		}
		const drawLineY=(lineY: number)=>{
			if (
				lineY>=viewBox.y1-bboxThickness/2 &&
				lineY<viewBox.y2+bboxThickness/2 &&
				bboxX1<bboxX2
			) drawLineXY(bboxX1,bboxX2,lineY,lineY)
		}
		drawLineX(itemX1+strokeWidth/2)
		drawLineX(itemX2-strokeWidth/2)
		drawLineY(itemY1+strokeWidth/2)
		drawLineY(itemY2-strokeWidth/2)
	}
	private addOrRemoveSvg(viewBox: RenderViewBox, $svg: SVGSVGElement): void {
		if ($svg.hasChildNodes()) {
			this.$layer.append($svg)
			setSvgAttributes($svg,{
				width: String(viewBox.x2-viewBox.x1),
				height: String(viewBox.y2-viewBox.y1)
			})
		} else {
			$svg.remove()
			removeSvgAttributes($svg,['width','height'])
		}
	}
}

function makeSvgElement<K extends keyof SVGElementTagNameMap>(tag: K, attrs: {[name:string]:string}={}): SVGElementTagNameMap[K] {
	const $e=document.createElementNS("http://www.w3.org/2000/svg",tag)
	setSvgAttributes($e,attrs)
	return $e
}
function setSvgAttributes($e: SVGElement, attrs: {[name:string]:string}): void {
	for (const name in attrs) {
		$e.setAttributeNS(null,name,attrs[name])
	}
}
function removeSvgAttributes($e: SVGElement, attrs: Iterable<string>): void {
	for (const name of attrs) {
		$e.removeAttributeNS(null,name)
	}
}
