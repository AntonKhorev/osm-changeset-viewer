import type {RenderView} from './base'
import Layer from './base'
import {TileProvider} from '../../net'
import {tilePxSize, calculatePxSize} from '../geo'
import {makeElement} from '../../util/html'

export default class TileLayer extends Layer {
	constructor(
		private tileProvider: TileProvider
	) {
		super()
	}
	render(view: RenderView): void {
		this.$layer.replaceChildren()
		// const viewTileX1=Math.floor(view.pxX1/tilePxSize)
		// const viewTileX2=Math.ceil(view.pxX2/tilePxSize)
		// const viewTileY1=Math.floor(view.pxY1/tilePxSize)
		// const viewTileY2=Math.ceil(view.pxY2/tilePxSize)
		const pxSize=calculatePxSize(view.z)
		for (let pxY=view.pxY1;pxY<view.pxY2;pxY+=tilePxSize) {
			const y=pxY*pxSize
			if (y<0 || y>=1) continue
			const tileY=Math.floor(pxY/tilePxSize)
			const tileOffsetPxY=tileY*tilePxSize-view.pxY1
			for (let pxX=view.pxX1;pxX<view.pxX2;pxX+=tilePxSize) {
				const x=pxX*pxSize
				const tileX=Math.floor((x-Math.floor(x))/pxSize/tilePxSize)
				const repeatedTileX=Math.floor(pxX/tilePxSize)
				const tileOffsetPxX=repeatedTileX*tilePxSize-view.pxX1
				const $img=makeElement('img')()()
				$img.src=this.tileProvider.urlTemplate
					.replace('{z}',String(view.z))
					.replace('{x}',String(tileX))
					.replace('{y}',String(tileY))
				$img.style.translate=`${tileOffsetPxX}px ${tileOffsetPxY}px`
				this.$layer.append($img)
			}
		}
	}
}
