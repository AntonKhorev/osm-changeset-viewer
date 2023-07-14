export default class Colorizer {
	private huesForUids=new Map<number,number>()
	getHueForUid(uid: number): number {
		const storedHue=this.huesForUids.get(uid)
		return storedHue ?? uid % 360
	}
	setHueForUid(uid: number, hue: number): void {
		this.huesForUids.set(uid,hue)
	}
	writeHueAttributes($e: HTMLElement, uid: number|undefined): void {
		if (uid!=null) {
			$e.dataset.hueUid=String(uid)
			$e.style.setProperty('--hue',String(this.getHueForUid(uid)))
			$e.style.setProperty('--saturation-factor','1')
		} else {
			$e.dataset.hueUid=''
			$e.style.setProperty('--hue','0')
			$e.style.setProperty('--saturation-factor','0')
		}
	}
}
