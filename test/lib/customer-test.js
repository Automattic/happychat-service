import customer from '../../lib/customer'
import { ok, equal } from 'assert'
import { EventEmitter } from 'events'

describe( 'customer service', () => {
	let io
	beforeEach( () => {
		io = new EventEmitter()
	} )

	it( 'should allow connections', () => {
		let connected = false
		customer( { on: ( event, listener ) => {
			equal( event, 'connection' )
			equal( typeof( listener ), 'function' )
			connected = true
		}} )
		ok( connected )
	} )
} )
