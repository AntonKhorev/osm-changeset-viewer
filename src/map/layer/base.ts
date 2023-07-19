import type {RenderZoomBox} from '../geo'
import type Colorizer from '../../colorizer'
import {makeDiv} from '../../util/html'

export const STENCIL_ID_MASK=2n**60n - 1n 
export const STENCIL_CHANGESET_MASK=2n**60n
export const STENCIL_NOTE_MASK=2n**61n

export default abstract class Layer {
	$layer=makeDiv('layer')()
	abstract clear(): void
	abstract render(renderBox: RenderZoomBox, stencils: BigUint64Array, colorizer: Colorizer): void
}
