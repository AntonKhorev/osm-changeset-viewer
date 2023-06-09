export function escapeRegex(text: string) { // https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript/3561711
	return text.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&')
}

export function escapeXml(text: string) { // https://github.com/Inist-CNRS/node-xml-writer
	return text
		.replace(/&/g,'&amp;')
		.replace(/</g,'&lt;')
		.replace(/"/g,'&quot;')
		.replace(/\t/g,'&#x9;')
		.replace(/\n/g,'&#xA;')
		.replace(/\r/g,'&#xD;')
}

export function escapeHash(text: string) {
	// fns escape all chars but:
	// encodeURIComponent: A–Za–z0–9-_.!~*'()
	// encodeURI:          A–Za–z0–9-_.!~*'();/?:@$+,&=#
	// we need:            A-Za-z0-9-_.!~*'();/?:@$+,
	// we need anything allowed in url hash except & and = https://stackoverflow.com/a/26119120
	return encodeURI(text).replace(
		/[&=#]/g,
		c=>encodeURIComponent(c)
	)
}

export function makeEscapeTag(escapeFn: (text: string) => string): (strings: TemplateStringsArray, ...values: unknown[]) => string {
	return function(strings: TemplateStringsArray, ...values: unknown[]): string {
		let result=strings[0]
		for (let i=0;i<values.length;i++) {
			result+=escapeFn(String(values[i]))+strings[i+1]
		}
		return result
	}
}
