export default class Colorizer {
	private huesForUids=new Map<number,number>()
	getHueForUid(uid: number): number {
		const storedHue=this.huesForUids.get(uid)
		return storedHue ?? uid % 360
	}
	setHueForUid(uid: number, hue: number): void {
		this.huesForUids.set(uid,hue)
	}
}
