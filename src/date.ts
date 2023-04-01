const pad=(n: number): string => ('0'+n).slice(-2)

export function toIsoDateString(date: Date, separator='-'): string {
	return (
		date.getUTCFullYear()+separator+
		pad(date.getUTCMonth()+1)+separator+
		pad(date.getUTCDate())
	)
}

export function toIsoTimeString(date: Date, separator=':'): string {
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
