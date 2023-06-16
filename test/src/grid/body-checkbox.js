import {strict as assert} from 'assert'
import {JSDOM} from 'jsdom'
import GridBodyCheckboxHandler from '../../../test-build/grid/body-checkbox.js'

describe("GridBodyCheckboxHandler",()=>{
	const globalProperties=[
		'document',
		'HTMLElement',
		'HTMLInputElement',
	]
	beforeEach(function(){
		const jsdom=new JSDOM()
		this.window=jsdom.window
		for (const property of globalProperties) {
			global[property]=jsdom.window[property]
		}
	})
	afterEach(function(){
		for (const property of globalProperties) {
			delete global[property]
		}
	})
	it("triggers checkbox",()=>{
		const $gridBody=document.createElement('tbody')
		$gridBody.innerHTML=`<tr class="single"><td></td><td>`+
			`<div>`+
				`<span class="item changeset" data-timestamp="1666666666666" data-type="changeset" data-id="111111111">`+
					`<span class="icon"><input type="checkbox"></span>`+
				`</span>`+
			`</div>`+
		`</td></tr>`
		const handler=new GridBodyCheckboxHandler($gridBody)
		handler.triggerColumnCheckboxes(0,true)
		const $checkbox=$gridBody.querySelector('input')
		assert($checkbox.checked)
	})
})
