import Layer from './base'
import type {RenderPoint, RenderBox, RenderZoomBox, GeoBox} from '../geo'
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
const subcellSizeXY=2

export default class ItemLayer extends Layer {
	private items=new Map<string,ItemMapViewInfo>()
	private highlightedItems=new Set<string>()
	private subcells=new Map<number,[number,number]>
	private nSubcellsX=2
	private nSubcellsY=1
	private iSubcellX=1
	private iSubcellY=1
	private $canvas=makeElement('canvas')()()
	private ctx=this.$canvas.getContext('2d')
	private get cellSizeX() { return this.nSubcellsX*subcellSizeXY }
	private get cellSizeY() { return this.nSubcellsY*subcellSizeXY }
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
	}
	render(viewBox: RenderZoomBox, colorizer: Colorizer): void {
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
		const viewCellX1=Math.floor(viewBox.x1/this.cellSizeX)
		const viewCellX2=Math.ceil (viewBox.x2/this.cellSizeX)
		const viewCellY1=Math.floor(viewBox.y1/this.cellSizeY)
		const viewCellY2=Math.ceil (viewBox.y2/this.cellSizeY)
		const nCellsX=viewCellX2-viewCellX1+1
		const nCellsY=viewCellY2-viewCellY1+1
		if (nCellsX<=0 || nCellsY<=0) return

		const cells=new Map<number,Float32Array>(
			[...this.subcells.keys()].map(uid=>[uid,new Float32Array(nCellsX*nCellsY)])
		)
		const cellBorders=new Uint8Array(nCellsX*nCellsY)
		const changesets: {bbox:RenderBox,uid:number}[] = []
		const highlightedChangesets: {bbox:RenderBox,uid:number}[] = []
		const notes: {point:RenderPoint,uid:number}[] = []
		const highlightedNotes: {point:RenderPoint,uid:number}[] = []
		const noteIdsWithoutCellCollisions=this.findNoteIdsWithoutCellCollisions(viewBox.z,this.cellSizeX,this.cellSizeY)

		let globalMaxCellWeight=0
		for (const item of this.items.values()) {
			const key=item.type+':'+item.id
			const highlighted=this.highlightedItems.has(key)
			const userCells=cells.get(item.uid)
			if (!userCells) continue
			const bbox=this.getItemBboxFromInfo(item)
			for (let repeatU=repeatU1;repeatU<=repeatU2;repeatU++) {
				const uid=item.uid
				const itemX1=(calculateU(bbox.minLon)+repeatU)/xyUV
				const itemX2=(calculateU(bbox.maxLon)+repeatU)/xyUV
				const itemY1= calculateV(bbox.maxLat)/xyUV
				const itemY2= calculateV(bbox.minLat)/xyUV
				if (item.type=='changeset' && itemX2-itemX1>bboxThreshold && itemY2-itemY1>bboxThreshold) {
					const bbox={
						x1:Math.round(itemX1), x2:Math.round(itemX2),
						y1:Math.round(itemY1), y2:Math.round(itemY2)
					}
					if (highlighted) {
						highlightedChangesets.push({bbox,uid})
					} else {
						changesets.push({bbox,uid})
					}
				} else if (item.type=='note' && noteIdsWithoutCellCollisions.has(item.id)) {
					const noteRenderMargin=32
					if (
						itemX1>=viewBox.x1-noteRenderMargin &&
						itemX2<=viewBox.x2+noteRenderMargin &&
						itemY1>=viewBox.y1-noteRenderMargin &&
						itemY2<=viewBox.y2+noteRenderMargin
					) {
						const point={x:Math.round(itemX1), y:Math.round(itemY1)}
						if (highlighted) {
							highlightedNotes.push({point,uid})
						} else {
							notes.push({point,uid})
						}
					}
				} else {
					const itemCellX1=Math.floor(itemX1/this.cellSizeX)
					const itemCellX2=Math.floor(itemX2/this.cellSizeX)
					const itemCellY1=Math.floor(itemY1/this.cellSizeY)
					const itemCellY2=Math.floor(itemY2/this.cellSizeY)
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
		this.renderHeatmap(
			cells,globalMaxCellWeight,
			nCellsX,nCellsY,
			icx=>(icx+viewCellX1)*this.cellSizeX-viewBox.x1,
			icy=>(icy+viewCellY1)*this.cellSizeY-viewBox.y1,
			getCellFillStyle
		)
		this.renderChangesets(viewBox,changesets,false,getCellFillStyle)
		this.renderNotes(viewBox,notes,false,getCellFillStyle)
		this.renderHeatmapHighlights(
			cellBorders,
			nCellsX,nCellsY,
			icx=>(icx+viewCellX1)*this.cellSizeX-viewBox.x1,
			icy=>(icy+viewCellY1)*this.cellSizeY-viewBox.y1
		)
		this.renderChangesets(viewBox,highlightedChangesets,true,getCellFillStyle)
		this.renderNotes(viewBox,highlightedNotes,true,getCellFillStyle)
	}
	private findNoteIdsWithoutCellCollisions(z: number, cellSizeX: number, cellSizeY: number): Set<number> {
		const cells=new Map<string,number|null>()
		const xyUV=calculateXYUV(z)
		for (const item of this.items.values()) {
			if (item.type!='note') continue
			const itemX=calculateU(item.lon)/xyUV
			const itemY=calculateV(item.lat)/xyUV
			const itemCellX=Math.floor(itemX/cellSizeX)
			const itemCellY=Math.floor(itemY/cellSizeY)
			const key=`${itemCellX}:${itemCellY}`
			if (cells.has(key)) {
				cells.set(key,null)
			} else {
				cells.set(key,item.id)
			}
		}
		const resultIds=new Set<number>()
		for (const id of cells.values()) {
			if (id==null) continue
			resultIds.add(id)
		}
		return resultIds
	}
	private renderHeatmap(
		cells: Map<number,Float32Array>,
		globalMaxCellWeight: number,
		nCellsX: number, nCellsY: number,
		getCellX: (icx:number)=>number,
		getCellY: (icy:number)=>number,
		getCellFillStyle: (globalMaxCellWeight:number,cellWeight:number,uid:number)=>string
	): void {
		if (!this.ctx) return
		for (let icy=0;icy<nCellsY;icy++) {
			for (let icx=0;icx<nCellsX;icx++) {
				const cellX=getCellX(icx)
				const cellY=getCellY(icy)
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
					this.ctx.fillRect(cellX,cellY,this.cellSizeX,this.cellSizeY)
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
	}
	private renderHeatmapHighlights(
		cellBorders: Uint8Array,
		nCellsX: number, nCellsY: number,
		getCellX: (icx:number)=>number,
		getCellY: (icy:number)=>number
	): void {
		if (!this.ctx) return
		this.ctx.strokeStyle=highlightStroke
		for (let icy=0;icy<nCellsY;icy++) {
			for (let icx=0;icx<nCellsX;icx++) {
				const cellX=getCellX(icx)
				const cellY=getCellY(icy)
				const borders=cellBorders[icx+icy*nCellsX]
				if (borders) this.ctx.beginPath()
				if (borders&TOP) {
					this.ctx.moveTo(cellX,cellY+.5)
					this.ctx.lineTo(cellX+this.cellSizeX,cellY+.5)
				}
				if (borders&BOTTOM) {
					this.ctx.moveTo(cellX,cellY+this.cellSizeY-.5)
					this.ctx.lineTo(cellX+this.cellSizeX,cellY+this.cellSizeY-.5)
				}
				if (borders&LEFT) {
					this.ctx.moveTo(cellX+.5,cellY)
					this.ctx.lineTo(cellX+.5,cellY+this.cellSizeY)
				}
				if (borders&RIGHT) {
					this.ctx.moveTo(cellX+this.cellSizeX-.5,cellY)
					this.ctx.lineTo(cellX+this.cellSizeX-.5,cellY+this.cellSizeY)
				}
				if (borders) this.ctx.stroke()
			}
		}
	}
	private renderChangesets(
		viewBox: RenderBox,
		changesets: {bbox:RenderBox,uid:number}[],
		highlighted: boolean,
		getCellFillStyle: (globalMaxCellWeight:number,cellWeight:number,uid:number)=>string
	): void {
		for (const changeset of changesets) {
			this.renderBox(
				viewBox,
				getCellFillStyle(1,0.7,changeset.uid),
				bboxThickness, // TODO use weight in stroke
				changeset.bbox
			)
			if (highlighted) this.renderBox(
				viewBox,
				highlightStroke,
				highlightBoxThickness,
				changeset.bbox
			)
		}
	}
	private renderBox(
		viewBox: RenderBox,
		stroke: string, strokeWidth: number,
		box: RenderBox
	): void {
		const edgeX1=viewBox.x1-bboxThickness
		const edgeY1=viewBox.y1-bboxThickness
		const edgeX2=viewBox.x2-1+bboxThickness
		const edgeY2=viewBox.y2-1+bboxThickness
		const bboxX1=clamp(edgeX1,box.x1,edgeX2)
		const bboxX2=clamp(edgeX1,box.x2,edgeX2)
		const bboxY1=clamp(edgeY1,box.y1,edgeY2)
		const bboxY2=clamp(edgeY1,box.y2,edgeY2)
		const drawLineXY=(
			x1: number, x2: number,
			y1: number, y2: number
		)=>{
			if (!this.ctx) return
			this.ctx.save()
			this.ctx.lineWidth=strokeWidth
			this.ctx.strokeStyle=stroke
			this.ctx.beginPath()
			this.ctx.moveTo(x1-viewBox.x1,y1-viewBox.y1)
			this.ctx.lineTo(x2-viewBox.x1,y2-viewBox.y1)
			this.ctx.stroke()
			this.ctx.restore()
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
		drawLineX(box.x1+strokeWidth/2)
		drawLineX(box.x2-strokeWidth/2)
		drawLineY(box.y1+strokeWidth/2)
		drawLineY(box.y2-strokeWidth/2)
	}
	private renderNotes(
		viewBox: RenderBox,
		notes: {point:RenderPoint,uid:number}[],
		highlighted: boolean,
		getCellFillStyle: (globalMaxCellWeight:number,cellWeight:number,uid:number)=>string
	): void {
		if (!this.ctx) return
		for (const note of notes) {
			this.ctx.save()
			this.ctx.translate(
				note.point.x-viewBox.x1,
				note.point.y-viewBox.y1
			)
			this.ctx.fillStyle=getCellFillStyle(1,0.7,note.uid)
			this.traceNotePath(16,6)
			this.ctx.fill()
			if (highlighted) {
				this.ctx.strokeStyle=highlightStroke
				this.ctx.stroke()
			}
			this.ctx.restore()
		}
	}
	private traceNotePath(h: number, r: number): void {
		if (!this.ctx) return
		const rp=h-r
		const y=r**2/rp
		const x=Math.sqrt(r**2-y**2)
		const xt=x+x*(r+y)/(h-(r+y))
		this.ctx.beginPath()
		this.ctx.moveTo(0,0)
		this.ctx.arcTo(-xt,-h,0,-h,r)
		this.ctx.arcTo(+xt,-h,0,0,r)
		this.ctx.closePath()
	}
}
