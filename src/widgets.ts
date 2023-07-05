import {makeElement} from './util/html'

export function makeDisclosureButton(isExpanded: boolean, label: string): HTMLButtonElement {
	const $disclosure=makeElement('button')('disclosure')()
	$disclosure.title=(isExpanded?`Collapse`:`Expand`)+` `+label
	setDisclosureButtonState($disclosure,isExpanded)
	const r=5.5
	const s=3.5
	$disclosure.innerHTML=makeCenteredSvg(r,
		`<line x1="${-s}" x2="${s}" />`+
		`<line y1="${-s}" y2="${s}" class="vertical-stroke" />`,
	`stroke="currentColor"`)
	return $disclosure
}

export function getDisclosureButtonState($disclosure: HTMLButtonElement): boolean {
	return $disclosure.getAttribute('aria-expanded')=='true'
}
export function setDisclosureButtonState($disclosure: HTMLButtonElement, isExpanded: boolean): void {
	$disclosure.setAttribute('aria-expanded',String(isExpanded))
	if (isExpanded) {
		$disclosure.title=$disclosure.title.replace(`Expand`,`Collapse`)
	} else {
		$disclosure.title=$disclosure.title.replace(`Collapse`,`Expand`)
	}
}

export function makeCenteredSvg(r: number, content: string, attrs?: string): string {
	return `<svg width="${2*r}" height="${2*r}" viewBox="${-r} ${-r} ${2*r} ${2*r}"${attrs?' '+attrs:''}>${content}</svg>`
}
