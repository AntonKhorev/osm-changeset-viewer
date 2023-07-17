import {clamp} from '../math'

const tilePowSize=8
export const tileSizeXY=2**tilePowSize

// various kinds of coordinates:
// lat, lon [degrees]
// u, v [0..1]
// x, y [current zoom level pixels]

export type ViewPoint = {
	u: number
	v: number
}
export type ViewZoomPoint = ViewPoint & {
	z: number
}
export type ViewTimeZoomPoint = ViewZoomPoint & {
	time: number
}

export type RenderPoint = {
	x: number
	y: number
}

export type RenderViewBox = {
	x1: number
	x2: number
	y1: number
	y2: number
}
export type RenderViewZoomBox = RenderViewBox & {
	z: number
}

export function normalizeViewZoomPoint(view: ViewZoomPoint, maxZoom: number): ViewZoomPoint {
	const z=Math.round(clamp(0,view.z,maxZoom))
	const uvXY=calculateUVXY(z)
	const u=(Math.round(view.u*uvXY)&(uvXY-1))/uvXY
	const v=clamp(0,Math.round(view.v*uvXY),uvXY)/uvXY
	return {u,v,z}
}

export function calculateXYUV(zoom: number): number {
	return .5**(tilePowSize+zoom)
}
export function calculateUVXY(zoom: number): number {
	return 2**(tilePowSize+zoom)
}

export function calculateU(lon: number): number {
	return (lon+180)/360
}
export function calculateV(lat: number): number {
	const maxLat=85.0511287798
	const validLatRadians=clamp(-maxLat,lat,maxLat)*Math.PI/180
	return (1-Math.log(Math.tan(validLatRadians) + 1/Math.cos(validLatRadians))/Math.PI)/2
}

export function calculateLon(u: number): number {
	return u*360-180
}
export function calculateLat(v: number): number {
	const n=Math.PI-2*Math.PI*v
	return 180/Math.PI*Math.atan(.5*(Math.exp(n)-Math.exp(-n)))
}
