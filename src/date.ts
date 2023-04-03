import {makeElement} from './util/html'

const pad=(n: number): string => ('0'+n).slice(-2)

export function toIsoYearMonthString(date: Date, separator='-'): string {
	return (
		date.getUTCFullYear()+separator+
		pad(date.getUTCMonth()+1)
	)
}

function toIsoDateString(date: Date, separator='-'): string {
	return (
		date.getUTCFullYear()+separator+
		pad(date.getUTCMonth()+1)+separator+
		pad(date.getUTCDate())
	)
}

function toIsoTimeString(date: Date, separator=':'): string {
	return (
		pad(date.getUTCHours())+separator+
		pad(date.getUTCMinutes())+separator+
		pad(date.getUTCSeconds())
	)
}

export function toIsoString(date: Date, dateSeparator='-', timeSeparator=':'): string {
	return (
		toIsoDateString(date,dateSeparator)+
		'T'+
		toIsoTimeString(date,timeSeparator)+
		'Z'
	)
}

export function makeDateOutputFromString(dateString: string): HTMLTimeElement {
	const date=new Date(dateString)
	const isoDateString=toIsoDateString(date)
	const isoTimeString=toIsoTimeString(date)
	const $time=makeElement('time')()(
		makeElement('span')('date')(isoDateString),' ',
		makeElement('span')('time')(isoTimeString)
	)
	$time.dateTime=dateString
	$time.title=`${isoDateString} ${isoTimeString} UTC`
	return $time
}

export function installRelativeTimeListeners($root: HTMLElement): void {
	$root.addEventListener('mouseover',listener)
	$root.addEventListener('focusin',listener)
}

const units=[
	[1,'second'],
	[60,'minute'],
	[60*60,'hour'],
	[60*60*24,'day'],
	[60*60*24*7,'week'],
	[60*60*24*30,'month'],
	[60*60*24*365,'year'],
] as [duration:number,name:Intl.RelativeTimeFormatUnit][]

const relativeTimeFormat=new Intl.RelativeTimeFormat('en')

function listener(ev: Event) {
	if (!(ev.target instanceof Element)) return
	let $time: HTMLTimeElement
	if (ev.target instanceof HTMLTimeElement) {
		$time=ev.target
	} else if (ev.target.parentElement instanceof HTMLTimeElement) { // target is <span> inside <time>
		$time=ev.target.parentElement
	} else {
		return
	}
	if (!$time.dateTime) return
	const readableTime=$time.dateTime.replace('T',' ').replace('Z',' UTC')
	const t1ms=Date.parse($time.dateTime)
	const t2ms=Date.now()
	let relativeTime='just now'
	for (const [duration,name] of units) {
		if (t2ms-t1ms<duration*1500) break
		const timeDifferenceInUnits=Math.round((t1ms-t2ms)/(duration*1000))
		relativeTime=relativeTimeFormat.format(timeDifferenceInUnits,name)
	}
	$time.title=`${readableTime}, ${relativeTime}`
}
