import type {RenderZoomBox} from '../geo'
import type Colorizer from '../../colorizer'
import {makeDiv} from '../../util/html'

export default abstract class Layer {
	$layer=makeDiv('layer')()
	abstract clear(): void
	abstract render(viewBox: RenderZoomBox, colorizer: Colorizer): void
}
