import type {RenderView} from './base'
import Layer from './base'
import {calculatePxSize, calculateX, calculateY, clamp} from '../geo'
import type {ItemMapViewInfo} from '../../grid'
import type Colorizer from '../../colorizer'
import {makeElement} from '../../util/html'

const TOP=1
const RIGHT=2
const BOTTOM=4
const LEFT=8

const bboxPxThreshold=16
const bboxPxThickness=2
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
	render(view: RenderView, colorizer: Colorizer): void {
		if (!this.ctx) return
		const getCellFillStyle=(maxV:number,v:number,uid:number)=>`hsl(${colorizer.getHueForUid(uid)} 80% 50% / ${.5+.4*v/maxV})`

		this.$canvas.width=view.pxX2-view.pxX1
		this.$canvas.height=view.pxY2-view.pxY1
		this.clear()
		const pxSize=calculatePxSize(view.z)
		const repeatX1=Math.floor(view.pxX1*pxSize)
		const repeatX2=Math.floor(view.pxX2*pxSize)
		if (this.items.size<=0 || this.subcells.size<=0) return
		const subcellPxSize=2
		const cellPxSizeX=this.nSubcellsX*subcellPxSize
		const cellPxSizeY=this.nSubcellsY*subcellPxSize
		const viewCellX1=Math.floor(view.pxX1/cellPxSizeX)
		const viewCellX2=Math.ceil(view.pxX2/cellPxSizeX)
		const viewCellY1=Math.floor(view.pxY1/cellPxSizeY)
		const viewCellY2=Math.ceil(view.pxY2/cellPxSizeY)
		const nCellsX=viewCellX2-viewCellX1+1
		const nCellsY=viewCellY2-viewCellY1+1
		if (nCellsX<=0 || nCellsY<=0) return
		const cells=new Map<number,Float32Array>(
			[...this.subcells.keys()].map(uid=>[uid,new Float32Array(nCellsX*nCellsY)])
		)
		const cellBorders=new Uint8Array(nCellsX*nCellsY)
		let maxValue=0
		for (const item of this.items.values()) {
			const key=item.type+':'+item.id
			const highlighted=this.highlightedItems.has(key)
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
				const itemPxX1=(calculateX(minLon)+repeatX)/pxSize
				const itemPxX2=(calculateX(maxLon)+repeatX)/pxSize
				const itemPxY1=calculateY(maxLat)/pxSize
				const itemPxY2=calculateY(minLat)/pxSize
				if (itemPxX2-itemPxX1>bboxPxThreshold && itemPxY2-itemPxY1>bboxPxThreshold) {
					this.renderBbox(
						view,this.$bboxSvg,
						getCellFillStyle(1,0.7,item.uid),bboxPxThickness, // TODO use weight in stroke
						Math.round(itemPxX1),Math.round(itemPxX2),
						Math.round(itemPxY1),Math.round(itemPxY2)
					)
					if (highlighted) this.renderBbox(
						view,this.$highlightBboxSvg,
						highlightStroke,highlightBoxThickness,
						Math.round(itemPxX1),Math.round(itemPxX2),
						Math.round(itemPxY1),Math.round(itemPxY2)
					)
				} else {
					const itemCellX1=Math.floor(itemPxX1/cellPxSizeX)
					const itemCellX2=Math.floor(itemPxX2/cellPxSizeX)
					const itemCellY1=Math.floor(itemPxY1/cellPxSizeY)
					const itemCellY2=Math.floor(itemPxY2/cellPxSizeY)
					const weightPerCell=item.weight/((itemCellX2-itemCellX1+1)*(itemCellY2-itemCellY1+1))
					for (let cy=Math.max(itemCellY1,viewCellY1);cy<=Math.min(itemCellY2,viewCellY2);cy++) {
						for (let cx=Math.max(itemCellX1,viewCellX1);cx<=Math.min(itemCellX2,viewCellX2);cx++) {
							const idx=(cx-viewCellX1)+(cy-viewCellY1)*nCellsX
							const value=userCells[idx]+=weightPerCell
							if (maxValue<value) maxValue=value
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
		this.addOrRemoveSvg(view,this.$bboxSvg)
		this.addOrRemoveSvg(view,this.$highlightBboxSvg)
		for (let icy=0;icy<nCellsY;icy++) {
			for (let icx=0;icx<nCellsX;icx++) {
				const cellPxX=(icx+viewCellX1)*cellPxSizeX-view.pxX1
				const cellPxY=(icy+viewCellY1)*cellPxSizeY-view.pxY1
				let cellMaxValueUid:number|undefined
				let cellMaxValue=0
				for (const [uid] of this.subcells) {
					const userCells=cells.get(uid)
					if (!userCells) continue
					const value=userCells[icx+icy*nCellsX]
					if (value>cellMaxValue) {
						cellMaxValue=value
						cellMaxValueUid=uid
					}
				}
				if (cellMaxValueUid==null) continue
				{
					const userCells=cells.get(cellMaxValueUid)
					if (!userCells) continue
					this.ctx.fillStyle=getCellFillStyle(maxValue,cellMaxValue,cellMaxValueUid)
					this.ctx.fillRect(cellPxX,cellPxY,cellPxSizeX,cellPxSizeY)
				}
				for (const [uid,[scx,scy]] of this.subcells) {
					if (uid==cellMaxValueUid) continue
					const userCells=cells.get(uid)
					if (!userCells) continue
					const value=userCells[icx+icy*nCellsX]
					if (value<=0) continue
					const subcellPxX=cellPxX+scx*subcellPxSize-subcellPxSize/2
					const subcellPxY=cellPxY+scy*subcellPxSize-subcellPxSize/2
					this.ctx.fillStyle=getCellFillStyle(maxValue,value,uid)
					this.ctx.clearRect(subcellPxX,subcellPxY,subcellPxSize,subcellPxSize)
					this.ctx.fillRect(subcellPxX,subcellPxY,subcellPxSize,subcellPxSize)
				}
			}
		}
		this.ctx.strokeStyle=highlightStroke
		for (let icy=0;icy<nCellsY;icy++) {
			for (let icx=0;icx<nCellsX;icx++) {
				const cellPxX=(icx+viewCellX1)*cellPxSizeX-view.pxX1
				const cellPxY=(icy+viewCellY1)*cellPxSizeY-view.pxY1
				const borders=cellBorders[icx+icy*nCellsX]
				if (borders) this.ctx.beginPath()
				if (borders&TOP) {
					this.ctx.moveTo(cellPxX,cellPxY+.5)
					this.ctx.lineTo(cellPxX+cellPxSizeX,cellPxY+.5)
				}
				if (borders&BOTTOM) {
					this.ctx.moveTo(cellPxX,cellPxY+cellPxSizeY-.5)
					this.ctx.lineTo(cellPxX+cellPxSizeX,cellPxY+cellPxSizeY-.5)
				}
				if (borders&LEFT) {
					this.ctx.moveTo(cellPxX+.5,cellPxY)
					this.ctx.lineTo(cellPxX+.5,cellPxY+cellPxSizeY)
				}
				if (borders&RIGHT) {
					this.ctx.moveTo(cellPxX+cellPxSizeX-.5,cellPxY)
					this.ctx.lineTo(cellPxX+cellPxSizeX-.5,cellPxY+cellPxSizeY)
				}
				if (borders) this.ctx.stroke()
			}
		}
	}
	private renderBbox(
		view: RenderView, $svg: SVGSVGElement,
		stroke: string, strokeWidth: number,
		itemPxX1: number, itemPxX2: number,
		itemPxY1: number, itemPxY2: number
	): void {
		const edgePxX1=view.pxX1-bboxPxThickness
		const edgePxY1=view.pxY1-bboxPxThickness
		const edgePxX2=view.pxX2-1+bboxPxThickness
		const edgePxY2=view.pxY2-1+bboxPxThickness
		const bboxPxX1=clamp(edgePxX1,itemPxX1,edgePxX2)
		const bboxPxX2=clamp(edgePxX1,itemPxX2,edgePxX2)
		const bboxPxY1=clamp(edgePxY1,itemPxY1,edgePxY2)
		const bboxPxY2=clamp(edgePxY1,itemPxY2,edgePxY2)
		const drawLineXY=(
			x1: number, x2: number,
			y1: number, y2: number
		)=>{
			$svg.append(makeSvgElement('line',{
				x1: String(x1-view.pxX1),
				x2: String(x2-view.pxX1),
				y1: String(y1-view.pxY1),
				y2: String(y2-view.pxY1),
				stroke,
				'stroke-width': String(strokeWidth),
			}))
		}
		const drawLineX=(linePxX: number)=>{
			if (
				linePxX>=view.pxX1-bboxPxThickness/2 &&
				linePxX<view.pxX2+bboxPxThickness/2 &&
				bboxPxY1<bboxPxY2
			) drawLineXY(linePxX,linePxX,bboxPxY1,bboxPxY2)
		}
		const drawLineY=(linePxY: number)=>{
			if (
				linePxY>=view.pxY1-bboxPxThickness/2 &&
				linePxY<view.pxY2+bboxPxThickness/2 &&
				bboxPxX1<bboxPxX2
			) drawLineXY(bboxPxX1,bboxPxX2,linePxY,linePxY)
		}
		drawLineX(itemPxX1+strokeWidth/2)
		drawLineX(itemPxX2-strokeWidth/2)
		drawLineY(itemPxY1+strokeWidth/2)
		drawLineY(itemPxY2-strokeWidth/2)
	}
	private addOrRemoveSvg(view: RenderView, $svg: SVGSVGElement): void {
		if ($svg.hasChildNodes()) {
			this.$layer.append($svg)
			setSvgAttributes($svg,{
				width: String(view.pxX2-view.pxX1),
				height: String(view.pxY2-view.pxY1)
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
