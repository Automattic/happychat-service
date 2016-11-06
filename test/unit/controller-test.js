import { equal, deepEqual } from 'assert'
import { EventEmitter } from 'events'
import controllerMiddleware from 'middlewares/socket-io/controller'
import createStore from 'store'
import mockio from '../mock-io'
import WatchingMiddleware from '../mock-middleware'
import {
	AGENT_RECEIVE_MESSAGE,
	OPERATOR_RECEIVE_MESSAGE,
	CUSTOMER_RECEIVE_TYPING,
	agentInboundMessage,
	customerInboundMessage,
	operatorInboundMessage,
	customerTyping
} from 'chat-list/actions';
import {
	OPERATOR_RECEIVE_TYPING,
	updateIdentity,
	operatorTyping
} from 'operator/actions';

const debug = require( 'debug' )( 'happychat:test:controller' )

describe( 'Controller', () => {
	let customers, agents, operators, store, watchingMiddleware, io

	const watchForType = ( ... args ) => watchingMiddleware.watchForType( ... args )

	beforeEach( () => {
		customers = new EventEmitter()
		agents = new EventEmitter()
		operators = new EventEmitter()
		let chats = new EventEmitter()
		io = mockio().server
		watchingMiddleware = new WatchingMiddleware()
		store = createStore( {
			io,
			customers,
			operators,
			agents,
			chatlist: chats,
			middlewares: [ watchingMiddleware.middleware() ]
		} )
		controllerMiddleware( { customers, agents, operators, messageMiddlewares: [] } )
	} )

	const mockUser = { id: 'user-id', displayName: 'Furiosa' }
	const socketIdentifier = { id: mockUser.id, socketId: mockUser.id }

	describe( 'with user', () => {
		it( 'notifies agent when user joins', ( done ) => {
			agents.on( 'customer.join', ( { id, socketId }, { id: user_id, displayName } ) => {
				equal( id, 'user-id' )
				equal( socketId, 'user-id' )
				equal( user_id, 'user-id' )
				equal( displayName, 'Furiosa' )
				done()
			} )
			customers.emit( 'join', socketIdentifier, mockUser, new EventEmitter() )
		} )

		it( 'notifies agent when user disconnects', ( done ) => {
			agents.on( 'customer.disconnect', ( { id: chat_id }, { id: user_id, displayName } ) => {
				equal( chat_id, 'chat-id' )
				equal( user_id, 'user-id' )
				equal( displayName, 'Furiosa' )
				done()
			} )
			customers.emit( 'disconnect', { id: 'chat-id' }, mockUser )
		} )
	} )

	describe( 'customer message', () => {
		it( 'should notify customers', ( done ) => {
			customers.on( 'receive', ( chat, { id, session_id, text } ) => {
				equal( id, 'message-id' )
				equal( text, 'hello' )
				equal( session_id, 'user-id' )
				done()
			} )
			store.dispatch( customerInboundMessage(
				'user-id',
				{ session_id: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 }
			) )
		} )

		it( 'should notify agents', ( done ) => {
			watchForType( AGENT_RECEIVE_MESSAGE, action => {
				const { id, timestamp, session_id, text, author_id, author_type } = action.message
				equal( id, 'message-id' )
				equal( timestamp, 12345 )
				equal( author_type, 'customer' )
				equal( session_id, 'user-id' )
				equal( author_id, 'user-id' )
				equal( text, 'hello' )
				done()
			} )
			store.dispatch( customerInboundMessage(
				'user-id',
				{ session_id: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 }
			) )
		} )

		it( 'should notify operators', ( done ) => {
			watchingMiddleware.watchForType( OPERATOR_RECEIVE_MESSAGE, ( action ) => {
				equal( action.message.id, 'message-id' )
				equal( action.message.session_id, 'user-id' )
				equal( action.message.text, 'hello' )
				done()
			} )

			store.dispatch( customerInboundMessage(
				'user-id',
				{ session_id: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 }
			) )
		} )
	} )

	describe( 'agent message', () => {
		it( 'should notify agents', ( done ) => {
			watchForType( AGENT_RECEIVE_MESSAGE, action => {
				const { author_type, id, session_id, timestamp, author_id } = action.message
				equal( author_type, 'agent' )
				equal( author_id, 'author' )
				equal( id, 'message-id' )
				equal( session_id, 'chat-id' )
				equal( timestamp, 12345 )
				done()
			} )
			store.dispatch( agentInboundMessage( 'agent',
				{ id: 'message-id', session_id: 'chat-id', timestamp: 12345, author_id: 'author' }
			) )
		} )

		it( 'should notify customers', ( done ) => {
			customers.on( 'receive', ( chat, { author_type, id, session_id, timestamp, author_id } ) => {
				equal( author_type, 'agent' )
				equal( author_id, 'author' )
				equal( id, 'message-id' )
				equal( session_id, 'chat-id' )
				equal( timestamp, 12345 )
				done()
			} )
			//   - `id`: the id of the message
			// - `timestamp`: timestampe of the message
			// - `text`: content of the message
			// - `context`: the id of the channel the message was sent to
			// - `author_id`: the id of the author of the message
			// - `author_type`: One of `customer`, `support`, `agent`
			store.dispatch( agentInboundMessage( 'agent',
				{ id: 'message-id', session_id: 'chat-id', timestamp: 12345, author_id: 'author' }
			) )
		} )

		it( 'should notify operators', ( done ) => {
			customers.on( 'receive', ( chat, { author_type, id, session_id, timestamp, author_id } ) => {
				equal( author_type, 'agent' )
				equal( author_id, 'author' )
				equal( id, 'message-id' )
				equal( session_id, 'chat-id' )
				equal( timestamp, 12345 )
				done()
			} )
			store.dispatch( agentInboundMessage( 'agent',
				{ id: 'message-id', session_id: 'chat-id', timestamp: 12345, author_id: 'author' }
			) )
		} )
	} )

	describe( 'operator message', () => {
		it( 'should notify operators', ( done ) => {
			watchingMiddleware.watchForAction( {
				type: OPERATOR_RECEIVE_MESSAGE,
				id: 'chat-id',
				message: { id: 'message-id' }
			}, () => done() );

			store.dispatch( operatorInboundMessage(
				'chat-id', mockUser, { id: 'message-id', user: mockUser }
			) )
		} )

		it( 'should notify agents', ( done ) => {
			watchForType( AGENT_RECEIVE_MESSAGE, ( action ) => {
				const { author_type, id, session_id, timestamp, author_id, type } = action.message
				equal( author_type, 'operator' )
				equal( author_id, 'user-id' )
				equal( id, 'message-id' )
				equal( session_id, 'chat-id' )
				equal( timestamp, 12345 )
				equal( type, 'type' )
				done()
			} )
			store.dispatch( operatorInboundMessage(
				'chat-id', mockUser, { id: 'message-id', user: mockUser, timestamp: 12345, type: 'type' }
			) )
		} )

		it( 'should notify customers', ( done ) => {
			customers.on( 'receive', ( chat, message ) => {
				equal( chat.id, 'chat-id' )
				equal( message.id, 'message-id' )
				done()
			} )
			store.dispatch( operatorInboundMessage(
				'chat-id', mockUser, { id: 'message-id', user: mockUser, timestamp: 12345 }
			) )
		} )
	} )

	describe( 'customer `typing`', () => {
		it( 'should notify operators', ( done ) => {
			watchingMiddleware.watchForType( OPERATOR_RECEIVE_TYPING, ( action ) => {
				equal( action.id, 'chat-id' )
				equal( action.user.id, 'user-id' )
				equal( action.text, 'typing a message...' )
				done()
			} )

			store.dispatch( customerTyping( 'chat-id', { id: 'user-id'}, 'typing a message...' ) )
		} )
	} )

	describe( 'operator `typing`', () => {
		it( 'should notify operators', ( done ) => {
			watchingMiddleware.watchForType( OPERATOR_RECEIVE_TYPING, ( action ) => {
				equal( action.id, 'chat-id' )
				equal( action.user.id, 'user-id' )
				equal( action.text, 'typing a message...' )
				done()
			} )

			store.dispatch( operatorTyping( 'chat-id', { id: 'user-id' }, 'typing a message...' ) )
		} )

		it( 'should notify customers', ( done ) => {
			watchingMiddleware.watchForType( CUSTOMER_RECEIVE_TYPING, action => {
				const { id, user, text } = action
				equal( id, 'chat-id' )
				equal( user.id, 'user-id' )
				equal( text, 'typing a message...' )
				done()
			} )

			store.dispatch( operatorTyping( 'chat-id', { id: 'user-id' }, 'typing a message...' ) )
		} )
	} )

	describe( 'agents system.info', () => {
		it( 'should handle system.info event', done => {
			// need to insert operator
			store.dispatch( updateIdentity( { id: 'what' }, { id: 'operator' } ) )
			// authenticate an agent client
			agents.on( 'connection', ( socket, auth ) => auth( null, 'happy' ) )
			const { client } = io.of( '/agent' ).newClient()
			client.on( 'init', () => {
				client.emit( 'system.info', data => {
					deepEqual( data.chats, [] )
					deepEqual( data.operators, [ { id: 'operator', load: 0, capacity: 0 } ] )
					done()
				} )
			} ).connect()
		} )
	} )
} )
