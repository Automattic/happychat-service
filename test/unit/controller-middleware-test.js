import { equal, ok } from 'assert'
import makeController from '../../src/controller'
import { EventEmitter } from 'events'
import assign from 'lodash/assign'

const debug = require( 'debug' )( 'tinkerchat:test:controller-middleware' )

const notImplemented = ( reason = 'Not implemented' ) => {
	throw new Error( reason )
}

describe( 'Controller middleware', () => {
	var agents, operators, customers, controller

	beforeEach( () => {
		customers = new EventEmitter()
		agents = new EventEmitter()
		operators = new EventEmitter()
		controller = makeController( { agents, operators, customers } )
	} )

	it( 'should register middleware', () => {
		controller
		.middleware( () => {} )
		.middleware( () => {} )

		equal( controller.middlewares.length, 2 )
	} )

	it( 'should pass customer message through middleware', ( done ) => {
		var ranMiddleware = false
		controller.middleware( ( { origin, destination, chat, message, user } ) => {
			ranMiddleware = true
			equal( origin, 'customer' )
			equal( destination, 'customer' )
			equal( message.text, 'hello' )
			return assign( {}, message, {text: 'lol'} )
		} )
		customers.on( 'receive', ( chat, message ) => {
			ok( ranMiddleware )
			equal( message.text, 'hello' )
			done()
		} )
		customers.emit(
			'message',
			{ id: 'user-id' },
			{ context: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 }
		)
	} )
} )
