export function getHueFromUid(uid: number): number {
	return uid % 360
}
