import {clamp} from '../math'

const tilePowSize=8
export const tilePxSize=2**tilePowSize

export function calculatePxSize(zoom: number): number {
	return .5**(tilePowSize+zoom)
}

export function calculateX(lon: number): number {
	return (lon+180)/360
}

export function calculateY(lat: number): number {
	const maxLat=85.0511287798
	const validLatRadians=clamp(-maxLat,lat,maxLat)*Math.PI/180
	return (1-Math.log(Math.tan(validLatRadians) + 1/Math.cos(validLatRadians))/Math.PI)/2
}
