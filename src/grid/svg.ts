import {makeCenteredSvg} from '../widgets'

export function makeSvgOfCollection(): string {
	const r=4
	const c1=-10
	const c2=10-2*r
	return makeCenteredSvg(10,
		`<rect x="${c1}" y="${c1}" width="${2*r}" height="${2*r}" />`+
		`<rect x="${c1}" y="${c2}" width="${2*r}" height="${2*r}" />`+
		`<rect x="${c2}" y="${c1}" width="${2*r}" height="${2*r}" />`+
		`<rect x="${c2}" y="${c2}" width="${2*r}" height="${2*r}" />`+
		`<rect x="${-r}" y="${-r}" width="${2*r}" height="${2*r}" />`,
	`fill="currentColor"`)
}

export function makeSvgOfAllUsers(): string {
	return makeCenteredSvg(8,
		`<line y1="-6" y2="6" stroke="currentColor" stroke-width="2" />`+
		`<line y1="-6" y2="6" stroke="currentColor" stroke-width="2" transform="rotate(60)" />`+
		`<line y1="-6" y2="6" stroke="currentColor" stroke-width="2" transform="rotate(-60)" />`
	)
}

export function makeSvgOfUser(): string {
	return makeCenteredSvg(8,makeSvgElementsOfUser())
}

export function makeSvgOfNewUser(): string {
	return makeCenteredSvg(10,
		`<path d="${computeNewOutlinePath(9,7,10)}" fill="canvas" stroke="currentColor" stroke-width="2" />`+
		makeSvgElementsOfUser()
	)
}

export function makeSvgOfNote(): string {
	const s=3
	return makeCenteredSvg(10,
		`<path d="${computeNewOutlinePath(9.5,8,10)}" fill="none" stroke-width="1" />`+
		`<path d="${computeMarkerOutlinePath(16,6)}" fill="canvas" />`+
		`<line x1="${-s}" x2="${s}" />`+
		`<line y1="${-s}" y2="${s}" />`,
	`stroke="currentColor" stroke-width="2"`)
}

export function makeSvgOfComment(itemType: 'note'|'changeset', action?: string): string {
	if (itemType=='note') {
		const actionGlyph=makeSvgElementsOfActionGlyph(action)
		if (actionGlyph!=null) {
			return makeCenteredSvg(10,
				`<path d="${computeMarkerOutlinePath(16,6)}" fill="canvas" />`+
				actionGlyph,
			`stroke="currentColor" stroke-width="2"`)
		} else {
			const r=4
			return makeCenteredSvg(r,`<circle r=${r} fill="currentColor" />`)
		}
	} else {
		const r=4
		return makeCenteredSvg(r,`<rect x="${-r}" y="${-r}" width="${2*r}" height="${2*r}" fill="currentColor" />`)
	}
}

export function makeSvgOfBalloonRef(incoming=false,mute=false,action?:string): string {
	const flip=incoming?` transform="scale(-1,1)"`:``
	const balloonColors=`fill="transparent" stroke="var(--icon-frame-color)"`
	let balloon:string
	if (mute) {
		balloon=`<g${flip} ${balloonColors}>`+
			`<circle class="balloon-ref" r="6" />`+
			`<circle class="balloon-ref" r="2" cx="-6" cy="4" />`+
		`</g>`
	} else {
		const balloonPathData=`M-8,0 l2,-2 V-4 a2,2 0 0 1 2,-2 H4 a2,2 0 0 1 2,2 V4 a2,2 0 0 1 -2,2 H-4 a2,2 0 0 1 -2,-2 V2 Z`
		balloon=`<path class="balloon-ref"${flip} d="${balloonPathData}" ${balloonColors} />`
	}
	let balloonContents=(
		`<circle r=".7" fill="currentColor" cx="-3" />`+
		`<circle r=".7" fill="currentColor" />`+
		`<circle r=".7" fill="currentColor" cx="3" />`
	)
	const actionGlyph=makeSvgElementsOfActionGlyph(action)
	if (actionGlyph!=null) {
		balloonContents=`<g stroke="currentColor" stroke-width="2">${actionGlyph}</g>`
	}
	return `<svg width="15" height="13" viewBox="${incoming?-6.5:-8.5} -6.5 15 13">`+
		balloon+balloonContents+
	`</svg>`
}

export function makeSvgOfCommentTip(side: -1|1): string {
	return `<svg class="tip" width="7" height="13" viewBox="${side<0?-.5:-5.5} -6.5 7 13" fill="canvas">`+
		`<path d="M0,0L${-7*side},7V-7Z" class="balloon-part"></path>`+
		`<path d="M${-6*side},-6L0,0L${-6*side},6" fill="none" stroke="var(--balloon-frame-color)"></path>`+
	`</svg>`
}
export function makeSvgOfMuteCommentTip(side: -1|1): string {
	return `<svg class="tip" width="15" height="20" viewBox="${side<0?0:-15} -10 15 20" fill="canvas" stroke="var(--balloon-frame-color)">`+
		`<circle cx="${-10.5*side}" cy="-3.5" r="4" class="balloon-part" />`+
		`<circle cx="${-5.5*side}" cy="1.5" r="2" class="balloon-part" />`+
	`</svg>`
}

function makeSvgElementsOfActionGlyph(action?: string): string|undefined {
	const s=2.5
	if (action=='closed') {
		return `<path d="M${-s},0 L0,${s} L${s},${-s}" fill="none" />`
	} else if (action=='reopened') {
		return (
			`<line x1="${-s}" x2="${s}" y1="${-s}" y2="${s}" />`+
			`<line x1="${-s}" x2="${s}" y1="${s}" y2="${-s}" />`
		)
	} else if (action=='hidden') {
		return ``
	}
}

function makeSvgElementsOfUser(): string {
	return (
		`<circle cx="0" cy="-2" r="2.5" fill="currentColor" />`+
		`<path d="M -4,5.5 A 4 4 0 0 1 4,5.5 Z" fill="currentColor" />`
	)
}

function computeNewOutlinePath(R: number, r: number, n: number): string {
	let outline=``
	for (let i=0;i<n*2;i++) {
		const a=Math.PI*i/n
		const s=i&1?r:R
		outline+=(i?'L':'M')+
			(s*Math.cos(a)).toFixed(2)+','+
			(s*Math.sin(a)).toFixed(2)
	}
	outline+='Z'
	return outline
}

function computeMarkerOutlinePath(h: number, r: number): string {
	const rp=h-r
	const y=r**2/rp
	const x=Math.sqrt(r**2-y**2)
	const xf=x.toFixed(2)
	const yf=y.toFixed(2)
	return `M0,${rp} L-${xf},${yf} A${r},${r} 0 1 1 ${xf},${yf} Z`
}
