import type {RenderView} from './base'
import Layer from './base'
import {calculatePxSize, calculateX, calculateY} from '../geo'
import type {ItemMapViewInfo} from '../../grid'
import {getHueFromUid} from '../../colorizer'
import {makeElement} from '../../util/html'

export default class ItemLayer extends Layer {
	private items=new Map<string,ItemMapViewInfo>()
	private subcells=new Map<number,[number,number]>
	private nSubcellsX=2
	private nSubcellsY=1
	private iSubcellX=1
	private iSubcellY=1
	private $canvas=makeElement('canvas')()()
	private ctx=this.$canvas.getContext('2d')
	constructor() {
		super()
		this.$layer.append(this.$canvas)
	}
	removeAllItems(): void {
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
	clear(): void {
		if (!this.ctx) return
		this.ctx.clearRect(0,0,this.$canvas.width,this.$canvas.height)
	}
	render(view: RenderView): void {
		if (!this.ctx) return
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
		const cells=new Map<number,Uint16Array>(
			[...this.subcells.keys()].map(uid=>[uid,new Uint16Array(nCellsX*nCellsY)])
		)
		let maxValue=0
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
				const cy1=Math.floor(calculateY(maxLat)/(cellPxSizeY*pxSize))
				const cy2=Math.floor(calculateY(minLat)/(cellPxSizeY*pxSize))
				for (let cy=Math.max(cy1,viewCellY1);cy<=Math.min(cy2,viewCellY2);cy++) {
					for (let cx=Math.max(cx1,viewCellX1);cx<=Math.min(cx2,viewCellX2);cx++) {
						const value=userCells[(cx-viewCellX1)+(cy-viewCellY1)*nCellsX]+=1
						if (maxValue<value) maxValue=value
					}
				}
			}
		}
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
					const subcellPxX=cellPxX+scx*subcellPxSize+subcellPxSize/2
					const subcellPxY=cellPxY+scy*subcellPxSize+subcellPxSize/2
					this.ctx.fillStyle=getCellFillStyle(maxValue,value,uid)
					this.ctx.clearRect(subcellPxX,subcellPxY,subcellPxSize,subcellPxSize)
					this.ctx.fillRect(subcellPxX,subcellPxY,subcellPxSize,subcellPxSize)
				}
			}
		}
	}
}

function getCellFillStyle(maxV: number, v: number, uid: number): string {
	return `hsl(${getHueFromUid(uid)} 80% 50% / ${.5+.4*v/maxV})`
}
