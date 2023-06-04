import {strict as assert} from 'assert'
import {escapeHash} from '../../../test-build/util/escape.js'

describe("util / escapeHash",()=>{
	it("does nothing on latin letters",()=>{
		assert.equal(
			escapeHash(`abc`),
			`abc`
		)
	})
	it("does nothing on zoom/lat/lon values",()=>{
		assert.equal(
			escapeHash(`8/59.998/30.055`),
			`8/59.998/30.055`
		)
	})
	it("does nothing on regexp special chars",()=>{
		assert.equal(
			escapeHash(`-.*$+`),
			`-.*$+`
		)
	})
	it("encodes difference with encodeURI",()=>{
		assert.equal(
			escapeHash(`&=#`),
			`%26%3D%23`
		)
	})
	it("encodes cyrillic letters",()=>{
		assert.equal(
			escapeHash(`знак`),
			`%D0%B7%D0%BD%D0%B0%D0%BA`
		)
	})
})
