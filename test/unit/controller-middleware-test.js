import { equal } from 'assert'
import { EventEmitter } from 'events'
import assign from 'lodash/assign'
import createStore from 'store'
import mockio from '../mock-io'
import WatchingMiddleware from '../mock-middleware'
import middlewareInterface from 'middleware-interface'
import {
	agentInboundMessage,
	customerInboundMessage,
	operatorInboundMessage,
	AGENT_RECEIVE_MESSAGE,
	OPERATOR_RECEIVE_MESSAGE
} from 'chat-list/actions'

describe( 'Controller middleware', () => {
	let customers, agents, operators, watchingMiddleware
	let compat, store

	beforeEach( () => {
		customers = new EventEmitter()
		agents = new EventEmitter()
		operators = new EventEmitter()
		let chats = new EventEmitter()
		compat = middlewareInterface()
		watchingMiddleware = new WatchingMiddleware()
		store = createStore( {
			io: mockio().server,
			customers,
			operators,
			agents,
			chatlist: chats,
			messageMiddlewares: compat.middlewares(),
			middlewares: [ watchingMiddleware.middleware() ]
		} )
	} )

	it( 'should register middleware', () => {
		compat.external
		.middleware( () => {} )
		.middleware( () => {} )

		equal( compat.middlewares().length, 2 )
	} )

	it( 'should pass customer message through middleware', ( done ) => {
		compat.external.middleware( ( { origin, destination, message } ) => {
			equal( origin, 'customer' )
			equal( destination, 'customer' )
			equal( message.text, 'hello' )
			return assign( {}, message, {text: 'middleware intercepted'} )
		} )
		customers.on( 'receive', ( chat, message ) => {
			equal( message.text, 'middleware intercepted' )
			done()
		} )
		store.dispatch( customerInboundMessage(
			'user-id',
			{ context: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 }
		) )
	} )

	it( 'should pass customer message to operator', done => {
		compat.external.middleware( ( { origin, destination } ) => {
			if ( origin === 'customer' && destination === 'operator' ) {
				done()
			}
		} )
		store.dispatch( customerInboundMessage(
			'user-id',
			{ context: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 }
		) )
	} )

	it( 'should support promise based middleware', ( done ) => {
		compat.external.middleware( ( { origin, destination, message } ) => new Promise( ( resolve ) => {
			equal( origin, 'agent' )
			equal( destination, 'agent' )
			resolve( assign( {}, message, { text: 'hello world' } ) )
		} ) )

		watchingMiddleware.watchForType( AGENT_RECEIVE_MESSAGE, ( action ) => {
			const { message } = action
			equal( message.text, 'hello world' )
			done()
		} )

		store.dispatch( agentInboundMessage( 'agent',
			{ id: 'message-id', context: 'chat-id', timestamp: 12345, author_id: 'author' }
		) )
	} )

	it( 'should support callback based middleware', ( done ) => {
		compat.external.middleware( ( { origin, destination, message }, next ) => {
			equal( origin, 'operator' )
			equal( destination, 'operator' )
			next( assign( {}, message, { text: 'intercepted' } ) )
		} )

		watchingMiddleware.watchForType( OPERATOR_RECEIVE_MESSAGE, ( action ) => {
			equal( action.message.text, 'intercepted' )
			done()
		} )

		store.dispatch( operatorInboundMessage(
			'chat-id',
			{ id: 'op-id' },
			{ id: 'message-id', user: { id: 'op-id' }, timestamp: 12345 }
		) )
	} )

	it( 'should still succeed when middlewares fail', ( done ) => {
		compat.external
		.middleware( ( { message } ) => new Promise( ( resolve ) => {
			resolve( assign( {}, message, { text: 'goodbye' } ) )
		} ) )
		.middleware( () => {
			throw new Error( 'failed to work' )
		} )
		.middleware( ( { message } ) => assign( {}, message, { text: message.text + ' world' } ) )

		watchingMiddleware.watchForType( OPERATOR_RECEIVE_MESSAGE, ( action ) => {
			equal( action.message.text, 'goodbye world' )
			done()
		} )

		store.dispatch( customerInboundMessage(
			'user-id',
			{ context: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 }
		) )
	} )

	it.skip( 'should prevent message from sending by returning falsey message', ( done ) => {
		const failOnEmit = ( ... args ) => {
			done( new Error( 'message emitted: ' + JSON.stringify( args, null, '\t' ) ) )
		}
		compat.external.middleware( () => false )

		// if any of the namespaces send the message, fail the test
		customers.on( 'receive', failOnEmit )
		operators.on( 'receive', failOnEmit )
		agents.on( 'receive', failOnEmit )

		// kind of hacky, the end result is that nothing happens due to the middleware preventing the message from being sent
		setTimeout( done, 100 )

		store.dispatch( customerInboundMessage(
			'user-id',
			{ context: 'user-id', id: 'message-id', text: 'hello', timestamp: 1 }
		) )
	} )
} )
