export function clamp(v1: number, v: number, v2: number): number {
	return Math.min(Math.max(v1,v),v2)
}
