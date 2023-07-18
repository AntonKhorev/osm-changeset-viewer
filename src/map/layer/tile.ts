import Layer from './base'
import {TileProvider} from '../../net'
import type {RenderZoomBox} from '../geo'
import {tileSizeXY} from '../geo'
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
	render(viewBox: RenderZoomBox): void {
		this.clear()
		const viewTileX1=Math.floor(viewBox.x1/tileSizeXY)
		const viewTileX2=Math.ceil (viewBox.x2/tileSizeXY)
		const viewTileY1=Math.floor(viewBox.y1/tileSizeXY)
		const viewTileY2=Math.ceil (viewBox.y2/tileSizeXY)
		const tileMask=2**viewBox.z-1
		for (let tileY=viewTileY1;tileY<viewTileY2;tileY++) {
			if (tileY<0 || tileY>tileMask) continue
			const tileOffsetY=tileY*tileSizeXY-viewBox.y1
			for (let tileX=viewTileX1;tileX<viewTileX2;tileX++) {
				const tileOffsetX=tileX*tileSizeXY-viewBox.x1
				const $img=makeElement('img')()()
				$img.src=this.tileProvider.urlTemplate
					.replace('{z}',String(viewBox.z))
					.replace('{x}',String(tileX&tileMask))
					.replace('{y}',String(tileY&tileMask))
				$img.style.translate=`${tileOffsetX}px ${tileOffsetY}px`
				this.$layer.append($img)
			}
		}
	}
}
