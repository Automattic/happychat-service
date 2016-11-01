import { equal } from 'assert'
import makeController from 'controller'
import { EventEmitter } from 'events'
import assign from 'lodash/assign'
import createStore from 'store'
import mockio from '../mock-io'
import WatchingMiddleware from '../mock-middleware'
import { OPERATOR_RECEIVE } from '../../src/operator/actions';

describe( 'Controller middleware', () => {
	let controller, customers, agents, operators, store, watchingMiddleware

	beforeEach( () => {
		customers = new EventEmitter()
		agents = new EventEmitter()
		operators = new EventEmitter()
		let chats = new EventEmitter()
		watchingMiddleware = new WatchingMiddleware()
		store = createStore( {
			io: mockio().server,
			customers,
			operators,
			chatlist: chats,
			middlewares: [ watchingMiddleware.middleware() ]
		} )
		controller = makeController( { customers, agents, operators, store } )
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

		watchingMiddleware.watchForType( OPERATOR_RECEIVE, ( action ) => {
			equal( action.message.text, 'intercepted' )
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


		watchingMiddleware.watchForType( OPERATOR_RECEIVE, ( action ) => {
			equal( action.message.text, 'goodbye world' )
			done()
		} )

		customers.emit(
			'message',
			{ id: 'user-id' },
			{ context: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 }
		)
	} )

	it( 'should prevent message from sending by returning falsey message', ( done ) => {
		const failOnEmit = ( ... args ) => {
			done( new Error( 'message emitted: ' + JSON.stringify( args, null, '\t' ) ) )
		}
		controller.middleware( () => false )

		// if any of the namespaces send the message, fail the test
		customers.on( 'receive', failOnEmit )
		operators.on( 'receive', failOnEmit )
		agents.on( 'receive', failOnEmit )

		// kind of hacky, the end result is that nothing happens due to the middleware preventing the message from being sent
		setTimeout( done, 100 )

		customers.emit( 'message', { id: 'user-id', session_id: '1' }, { context: 'user-id', id: 'message-id', text: 'hello', timestamp: 1 } )
	} )
} )
