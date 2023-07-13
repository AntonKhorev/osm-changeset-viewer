import {makeDiv} from '../../util/html'

export type RenderView = {
	pxX1: number
	pxX2: number
	pxY1: number
	pxY2: number
	z: number
}

export default abstract class Layer {
	$layer=makeDiv()()
	abstract clear(): void
	abstract render(view: RenderView): void
}
