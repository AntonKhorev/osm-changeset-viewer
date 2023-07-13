import type {RenderView} from './base'
import Layer from './base'
import {TileProvider} from '../../net'
import {tilePxSize} from '../geo'
import {makeElement} from '../../util/html'

export default class TileLayer extends Layer {
	constructor(
		private tileProvider: TileProvider
	) {
		super()
	}
	clear(): void {
		this.$layer.replaceChildren()
	}
	render(view: RenderView): void {
		this.clear()
		const viewTileX1=Math.floor(view.pxX1/tilePxSize)
		const viewTileX2=Math.ceil(view.pxX2/tilePxSize)
		const viewTileY1=Math.floor(view.pxY1/tilePxSize)
		const viewTileY2=Math.ceil(view.pxY2/tilePxSize)
		const tileMask=2**view.z-1
		for (let tileY=viewTileY1;tileY<viewTileY2;tileY++) {
			if (tileY<0 || tileY>tileMask) continue
			const tileOffsetPxY=tileY*tilePxSize-view.pxY1
			for (let tileX=viewTileX1;tileX<viewTileX2;tileX++) {
				const tileOffsetPxX=tileX*tilePxSize-view.pxX1
				const $img=makeElement('img')()()
				$img.src=this.tileProvider.urlTemplate
					.replace('{z}',String(view.z))
					.replace('{x}',String(tileX&tileMask))
					.replace('{y}',String(tileY&tileMask))
				$img.style.translate=`${tileOffsetPxX}px ${tileOffsetPxY}px`
				this.$layer.append($img)
			}
		}
	}
}
