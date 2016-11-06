import { ok, equal, deepEqual } from 'assert'
import { EventEmitter } from 'events'
import { merge } from 'ramda'
import { tick } from '../tick'
import mockio from '../mock-io'
import createStore from 'store'
import WatchingMiddleware from '../mock-middleware'
import { OPERATOR_CLOSE_CHAT } from 'operator/actions';
import { ASSIGN_CHAT, SET_OPERATOR_CHATS_ABANDONED, SET_CHAT_MISSED, SET_CHATS_RECOVERED } from 'chat-list/actions';
import { OPERATOR_CHAT_TRANSFER } from 'middlewares/socket-io'
import { getChat, getChatStatus, getChatOperator } from 'chat-list/selectors'

const debug = require( 'debug' )( 'happychat:chat-list:test' )

const TIMEOUT = 10

describe( 'ChatList component', () => {
	let operators
	let customers
	let store
	let events
	let watchingMiddleware
	let io

	const emitCustomerMessage = ( text = 'hello', id = 'chat-id' ) => {
		customers.emit( 'message', { id }, { text } )
	}

	const chatlistWithState = ( state ) => {
		( { server: io } = mockio() )
		operators = new EventEmitter()
		customers = new EventEmitter()
		events = new EventEmitter()
		watchingMiddleware = new WatchingMiddleware()
		store = createStore(
			{ io, operators, customers, chatlist: events, agents: new EventEmitter(),
				middlewares: [ watchingMiddleware.middleware() ],
				timeout: 100 },
			state
		)
	}

	beforeEach( () => {
		chatlistWithState()
	} )

	it( 'should notify when new chat has started', ( done ) => {
		events.once( 'chat.status', tick( ( status, { id } ) => {
			equal( status, 'pending' )
			equal( id, 'chat-id' )
			done()
		} ) )
		emitCustomerMessage()
	} )

	it( 'should request operator for chat', ( done ) => {
		watchingMiddleware.watchForType( ASSIGN_CHAT, () => {
			done()
		} )
		emitCustomerMessage()
	} )

	const connectOperator = ( operator, capacity = 1, status = 'available' ) => new Promise( resolve => {
		// have an operator join
		operators.once( 'connection', ( socket, callback ) => {
			debug( 'authorizing', operator )
			callback( null, merge( operator, { capacity, status } ) )
		} )
		const operator_io = io.of( '/operator' )
		const { client, socket } = operator_io.connectNewClient( undefined, () => {
			client.once( 'init', ( user ) => {
				debug( 'init user', user )
				client.emit( 'status', status, () => {
					client.emit( 'capacity', capacity, () => {
						debug( 'operator ready', operator.id )
						resolve( { client, socket } )
					} )
				} )
			} )
		} )
	} )

	it( 'should move chat to active when operator found', () =>
		connectOperator( { id: 'awesome' } )
		.then( () => new Promise( resolve => {
			watchingMiddleware.watchForType( 'NOTIFY_CHAT_STATUS_CHANGED', action => {
				if ( action.status === 'assigned' && action.lastStatus === 'assigning' ) {
					resolve()
				}
			} )
			emitCustomerMessage()
		} ) )
	)

	it( 'should send chat event message when operator is found', ( done ) =>
		connectOperator( { id: 'operator-id' } )
		.then( ( { client } ) => {
			client.on( 'chat.message', ( chat, message ) => {
				equal( message.session_id, 'chat-id' )
				equal( message.meta.event_type, 'assigned' )
				equal( message.meta.operator.id, 'operator-id' )
				done()
			} )
			emitCustomerMessage()
		} )
	)

	it.skip( 'should timeout if no operator provided', () =>
		connectOperator( { id: 'ripley' } )
		.then( ( { socket } ) => new Promise( resolve => {
			socket.join = ( room, callback ) => callback( new Error( `failed to join ${ room }` ) )
			events.on( 'miss', tick( ( error, { id } ) => {
				equal( error.message, 'timeout' )
				equal( id, 'chat-id' )
				resolve()
			} ) )
			emitCustomerMessage()
		} ) )
	)

	it( 'should ask operators for status when customer joins', ( done ) => {
		chatlistWithState( { chatlist: { 'session-id': [ 'assigned' ] } } )
		const socket = new EventEmitter();

		socket.once( 'accept', ( accepted ) => {
			ok( ! accepted )
			done()
		} )

		customers.emit( 'join', { session_id: 'session-id' }, { id: 'session-id' }, socket )
	} )

	describe( 'with active chat', () => {
		const operator_id = 'operator_id'
		const chat = { id: 'the-id' }
		let client

		beforeEach( () => {
			// TODO: the operator needs to be authenticated before it can close chats
			chatlistWithState( { chatlist: { 'the-id': [ 'assigned', chat, { id: operator_id }, 1, {} ] } } )
			return connectOperator( { id: operator_id } )
			.then( ( { client: c } ) => {
				client = c
				return Promise.resolve()
			} )
		} )

		it( 'should store assigned operator', () => {
			equal( getChatOperator( chat.id, store.getState() ).id, operator_id )
		} )

		it( 'should send message from customer', done => {
			client.once( 'chat.message', ( _chat, message ) => {
				deepEqual( _chat, chat )
				deepEqual( message, { text: 'hola mundo' } )
				done()
			} )
			emitCustomerMessage( 'hola mundo', 'the-id' )
		} )

		it( 'should mark chats as abandoned when operator is completely disconnected', ( done ) => {
			watchingMiddleware.watchForType( SET_OPERATOR_CHATS_ABANDONED, () => {
				equal( getChatStatus( 'the-id', store.getState() ), 'abandoned' )
				done()
			}, true )
			client.disconnect()
		} )

		it( 'should allow operator to close chat', ( done ) => {
			watchingMiddleware.watchForType( OPERATOR_CLOSE_CHAT, ( action ) => {
				console.error( 'action', action )
				equal( action.operator.id, operator_id )
				deepEqual( action.chat, chat )
				ok( ! getChat( chat.id, store.getState() ) )
				done()
			} )
			client.emit( 'chat.close', 'the-id' )
		} )

		it( 'should request chat transfer', ( done ) => {
			watchingMiddleware.watchForType( OPERATOR_CHAT_TRANSFER, ( action ) => {
				equal( action.chat_id, 'the-id' )
				equal( action.user.id, operator_id )
				// No operator connected so user is undefined
				equal( action.toUser, undefined )
				done()
			} )
			client.emit( 'chat.transfer', chat.id, 'other-user' )
		} )

		it( 'should timeout when transfering chat to unavailable operator', ( done ) => {
			const newOperator = { id: 'new-operator' }
			watchingMiddleware.watchForTypeOnce( SET_CHAT_MISSED, action => {
				equal( action.chat_id, chat.id )
				equal( action.error.message, 'operator not available' )
				done()
			} )
			client.emit( 'chat.transfer', chat.id, newOperator.id )
		} )

		it( 'should transfer chat to new operator', () => {
			const newOperator = { id: 'new-operator' }
			return connectOperator( newOperator )
			.then( () => new Promise( resolve => {
				watchingMiddleware.watchForType( OPERATOR_CHAT_TRANSFER, action => {
					equal( action.chat_id, chat.id )
					equal( action.user.id, operator_id )
					equal( action.toUser.id, newOperator.id )
					resolve()
				} )
				client.emit( 'chat.transfer', chat.id, newOperator.id )
			} ) )
		} )

		it( 'should log message when chat is transferred', done => {
			const newOperator = { id: 'new-operator' }
			return connectOperator( newOperator ).then( () => {
				events.once( 'miss', () => {
					done( new Error( 'failed to transfer chat' ) )
				} )
				operators.once( 'transfer', ( cht, from, op, success ) => success( null, op ) )
				operators.once( 'message', tick( ( { id: chat_id }, operator, message ) => {
					equal( chat_id, chat.id )
					ok( message.id )
					ok( message.timestamp )
					equal( message.type, 'event' )
					equal( message.text, 'chat transferred' )
					deepEqual( message.meta.to.id, newOperator.id )
					deepEqual( message.meta.from.id, operator_id )
					equal( message.meta.event_type, 'transfer' )
					done()
				} ) )
				client.emit( 'chat.transfer', chat.id, newOperator.id )
			} )
		} )

		it( 'should send message when operator joins', done => {
			const newOperator = { id: 'joining-operator' }
			return connectOperator( newOperator ).then( connection => {
				operators.once( 'message', tick( ( { id: chat_id }, operator, message ) => {
					equal( chat_id, chat.id )
					ok( message.id )
					deepEqual( message.meta.operator.id, newOperator.id )
					equal( message.meta.event_type, 'join' )
					done()
				} ) )
				connection.client.emit( 'chat.join', chat.id )
			} )
		} )

		it( 'should send message when operator leaves', done => {
			operators.once( 'message', tick( ( { id: chat_id }, operator, message ) => {
				equal( chat_id, chat.id )
				deepEqual( message.meta.operator.id, operator_id )
				equal( message.meta.event_type, 'leave' )
				ok( message )
				done()
			} ) )
			client.emit( 'chat.leave', chat.id )
		} )

		it( 'should send a message when operator closes chat', done => {
			operators.once( 'message', tick( ( _chat, operator, message ) => {
				equal( operator.id, operator_id )
				deepEqual( _chat, chat )
				equal( message.type, 'event' )
				equal( message.meta.by.id, operator_id )
				equal( message.meta.event_type, 'close' )
				done()
			} ) )
			client.emit( 'chat.close', chat.id )
		} )
	} )

	describe( 'with abandoned chat', () => {
		it( 'should reassign operator and make chats active', ( done ) => {
			const operator_id = 'operator-id'
			const chat_id = 'chat-id'

			chatlistWithState( { chatlist:
				{ 'chat-id': [ 'abandoned', { id: chat_id }, { id: operator_id }, 1, {} ] }
			} )

			watchingMiddleware.watchForType( SET_CHATS_RECOVERED, () => {
				equal( getChatStatus( 'chat-id', store.getState() ), 'assigned' )
				equal( getChatOperator( 'chat-id', store.getState() ).id, operator_id )
				done()
			}, true )
			connectOperator( { id: operator_id } )
		} )
	} )

	describe( 'with customer disconnect', () => {
		const operator_id = 'operator-id'
		const chat_id = 'chat-id'
		const user = { id: 'user-id' }
		const chat = { id: chat_id }
		const operator = { id: operator_id }

		beforeEach( () => {
			chatlistWithState( { chatlist: { [ chat_id ]: [ 'assigned', chat, operator, 1, {} ] } } )
		} )

		it( 'should send a message when customer disconnects', ( done ) => {
			operators.once( 'message', tick( ( _chat, _operator, message ) => {
				equal(
					getChatStatus( _chat.id, store.getState() ),
					'customer-disconnect'
				)
				equal( _operator.id, operator_id )
				deepEqual( _chat, chat )
				equal( message.type, 'event' )
				equal( message.meta.event_type, 'customer-leave' )
				done()
			} ) )

			customers.emit( 'disconnect', chat, user )
		} )

		it( 'should revert back to assigned when customer disconnects and returns', ( done ) => {
			events.once( 'chat.status', tick( ( status, _chat ) => {
				equal( status, 'customer-disconnect' )
				deepEqual( chat, _chat )

				events.once( 'chat.status', tick( ( __status, __chat ) => {
					equal( __status, 'assigned' )
					deepEqual( chat, __chat )
				} ) )

				operators.on( 'message', tick( ( _, _operator, message ) => {
					if ( message.meta.event_type === 'customer-leave' ) {
						throw new Error( 'operator should not be sent a message' )
					}
				} ) )

				const socket = new EventEmitter()
				customers.emit( 'join', { id: user.id, socket_id: 'socket-id', session_id: 'session-id' }, chat, socket )

				// call done() after timeout to verify that operator message isn't sent
				setTimeout( () => done(), TIMEOUT + 1 )
			} ) )

			customers.emit( 'disconnect', chat, user )
		} )
	} )
} )
