import { equal } from 'assert'
import makeController from '../../src/controller'
import { EventEmitter } from 'events'
import assign from 'lodash/assign'

const debug = require( 'debug' )( 'happychat:test:controller-middleware' )

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
		controller.middleware( ( { origin, destination, message } ) => {
			equal( origin, 'customer' )
			equal( destination, 'customer' )
			equal( message.text, 'hello' )
			return assign( {}, message, {text: 'middleware intercepted'} )
		} )
		customers.on( 'receive', ( chat, message ) => {
			equal( message.text, 'middleware intercepted' )
			done()
		} )
		customers.emit(
			'message',
			{ id: 'user-id' },
			{ context: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 }
		)
	} )

	it( 'should pass customer message to operator', done => {
		controller.middleware( ( { origin, destination } ) => {
			if ( origin === 'customer' && destination === 'operator' ) {
				done()
			}
		} )
		customers.emit(
			'message',
			{ id: 'user-id' },
			{ context: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 }
		)
	} )

	it( 'should support promise based middleware', ( done ) => {
		controller.middleware( ( { origin, destination, message } ) => new Promise( ( resolve ) => {
			equal( origin, 'agent' )
			equal( destination, 'agent' )
			resolve( assign( {}, message, { text: 'hello world' } ) )
		} ) )
		agents.on( 'receive', ( message ) => {
			equal( message.text, 'hello world' )
			done()
		} )
		agents.emit(
			'message',
			{ id: 'message-id', context: 'chat-id', timestamp: 12345, author_id: 'author' }
		)
	} )

	it( 'should support callback based middleware', ( done ) => {
		controller.middleware( ( { origin, destination, message }, next ) => {
			equal( origin, 'operator' )
			equal( destination, 'operator' )
			next( assign( {}, message, { text: 'intercepted' } ) )
		} )
		operators.on( 'receive', ( chat, message ) => {
			equal( message.text, 'intercepted' )
			done()
		} )
		operators.emit(
			'message',
			{ id: 'chat-id' },
			{ id: 'op-id' },
			{ id: 'message-id', user: { id: 'op-id' }, timestamp: 12345 }
		)
	} )

	it( 'should still succeed when middlewares fail', ( done ) => {
		controller
		.middleware( ( { message } ) => new Promise( ( resolve ) => {
			resolve( assign( {}, message, { text: 'goodbye' } ) )
		} ) )
		.middleware( () => {
			throw new Error( 'failed to work' )
		} )
		.middleware( ( { message } ) => assign( {}, message, { text: message.text + ' world' } ) )

		operators.on( 'receive', ( chat, { text } ) => {
			equal( text, 'goodbye world' )
			done()
		} )
		customers.emit(
			'message',
			{ id: 'user-id' },
			{ context: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 }
		)
	} )
} )
