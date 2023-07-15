import {strict as assert} from 'assert'
import decorateUserName from '../../../test-build/grid/user-name-decorator.js'

describe("grid / decorateUserName",()=>{
	it("does nothing on latin letters",()=>{
		const name='purename'
		const decoratedName=decorateUserName(name)
		assert.deepEqual(decoratedName,
			[['purename']]
		)
	})
	it("detects embedded cyrillic letters",()=>{
		const name='nonpurеname'
		const decoratedName=decorateUserName(name)
		assert.deepEqual(decoratedName,
			[['nonpur'],['е',{belongsTo:'Cyrl',surroundedBy:'Latn'}],['name']]
		)
	})
	it("detects multiple runs of embedded cyrillic letters",()=>{
		const name='nonрurеname'
		const decoratedName=decorateUserName(name)
		assert.deepEqual(decoratedName,
			[['non'],['р',{belongsTo:'Cyrl',surroundedBy:'Latn'}],['ur'],['е',{belongsTo:'Cyrl',surroundedBy:'Latn'}],['name']]
		)
	})
	it("skips obvious cyrillic",()=>{
		const name='nonpurжname'
		const decoratedName=decorateUserName(name)
		assert.deepEqual(decoratedName,
			[['nonpurжname']]
		)
	})
})
