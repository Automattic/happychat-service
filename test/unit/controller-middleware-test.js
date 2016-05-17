import { ok } from 'assert'
import makeController from '../../src/controller'
import { EventEmitter } from 'events'

const notImplemented = ( reason = 'Not implemented' ) => {
	throw new Error( reason )
}

describe( 'controller middleware', () => {
	it( 'should intercept messages', () => {
		const customers = new EventEmitter()
		const agents = new EventEmitter()
		const operators = new EventEmitter()
		const controller = makeController( {
			customers, agents, operators
		} )
		notImplemented()
	} )
} )
