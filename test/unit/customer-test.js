import { EventEmitter } from 'events'
import mockIO from '../mock-io'
import { contains, ok, equal, deepEqual } from '../assert'
import createStore from 'store'
import WatchingMiddleware from '../mock-middleware'
import {
	CUSTOMER_TYPING,
	CUSTOMER_INBOUND_MESSAGE,
	CUSTOMER_JOIN,
	customerReceiveTyping,
	customerReceiveMessage
} from 'chat-list/actions'

const debug = require( 'debug' )( 'happychat:test:customer' )

describe( 'Customer Service', () => {
	let server, socket, client, customerEvents, events, watching, store
	const mockUser = {
		id: 'abdefgh',
		username: 'ridley',
		name: 'Ridley',
		picture: 'http://example.com/image',
		session_id: 'abdefgh-chat'
	}
	let auth
	const watchForType = ( ... args ) => watching.watchForType( ... args )

	beforeEach( () => {
		// export default ( { io, customers, operators, chatlist, middlewares = [], timeout = undefined }, state ) => createStore(
		const { server: io } = mockIO()
		events = customerEvents = new EventEmitter();
		watching = new WatchingMiddleware()
		store = createStore( {
			io: io,
			customers: customerEvents,
			operators: new EventEmitter(),
			chatlist: new EventEmitter(),
			agents: new EventEmitter(),
			timeout: 10,
			middlewares: [ watching.middleware() ]
		} )
		server = io.of( '/customer' );
		( { client, socket } = server.newClient() )
		auth = ( next = () => {} ) => {
			// customer( customerIO, customerEvents )
			customerEvents.on( 'connection', ( _socket, authUser ) => {
				authUser( null, mockUser )
				client.on( 'init', () => next() )
			} )
			server.emit( 'connection', socket )
			return customerEvents
		}
	} )

	describe( 'with authorized user', () => {
		beforeEach( ( next ) => {
			customerEvents = auth( next )
		} )

		it( 'should receive message and broadcast it', ( done ) => {
			watchForType( CUSTOMER_INBOUND_MESSAGE, action => {
				const { chat, message } = action
				const { id, text, timestamp, user, meta, session_id } = message
				equal( chat.id, mockUser.session_id )
				equal( chat.user_id, mockUser.id )
				equal( session_id, mockUser.session_id )
				equal( id, 'message-id' )
				equal( text, 'hello world' )
				ok( timestamp )
				ok( meta )
				deepEqual( user, {
					id: mockUser.id,
					name: mockUser.name,
					username: mockUser.username,
					picture: mockUser.picture
				} )
				done()
			} )
			client.emit( 'message', { id: 'message-id', text: 'hello world', meta: {} } )
		} )

		it( 'should receive message via dispatch', ( done ) => {
			client.once( 'message', ( message ) => {
				equal( message.text, 'hello' )
				done()
			} )
			store.dispatch( customerReceiveMessage(
				mockUser.session_id,
				{ text: 'hello', user: mockUser }
			) )
		} )

		it( 'should handle `typing` from client and pass to events', ( done ) => {
			watchForType( CUSTOMER_TYPING, action => {
				const { id, user, text } = action
				equal( id, mockUser.session_id )
				equal( user.id, mockUser.id )
				equal( text, 'This is a message...' )
				done()
			} )

			client.emit( 'typing', 'This is a message...' )
		} )

		it( 'should handle `receive.typing` from events (with string literal)', ( done ) => {
			client.once( 'typing', ( isTyping ) => {
				equal( isTyping, true )
				done()
			} )

			store.dispatch( customerReceiveTyping( mockUser.session_id, mockUser, 'typing' ) )
		} )

		it( 'should handle `receive.typing` from events (with String object)', ( done ) => {
			client.once( 'typing', ( isTyping ) => {
				equal( isTyping, true )
				done()
			} )
			store.dispatch( customerReceiveTyping( mockUser.session_id, mockUser, new String( 'typing' ) ) )
		} )

		it( 'should handle `receive.typing` from events (with no text)', ( done ) => {
			client.once( 'typing', ( isTyping ) => {
				equal( isTyping, false )
				done()
			} )
			store.dispatch( customerReceiveTyping( mockUser.session_id, mockUser, false ) )
		} )

		it.skip( 'should handle accept event', done => {
			server.once( 'accept', ( accepted ) => {
				// TODO: this test is not determinant for the value of accepted
				ok( !accepted )
				done()
			} )
			customerEvents.emit( 'accept', { id: mockUser.session_id }, false )
		} )
	} )

	it( 'should emit connection', ( done ) => {
		customerEvents.on( 'connection', () => {
			done()
		} )
		server.emit( 'connection', socket )
	} )

	it( 'should authenticate and init client', ( done ) => {
		customerEvents.once( 'connection', ( _socket, authUser ) => {
			authUser( null, { id: 'user1', username: 'user1', session_id: 'session' } )
		} )

		client.once( 'init', () => {
			contains( socket.rooms, 'session/session' )
			done()
		} )

		server.emit( 'connection', socket )
	} )

	it( 'should notify user join and leave', ( done ) => {
		socket.id = 'socket-id'

		events.on( 'disconnect-socket', ( { socketIdentifier, chat, user } ) => {
			equal( socketIdentifier.id, mockUser.id )
			equal( socketIdentifier.socket_id, 'socket-id' )
			equal( chat.user_id, mockUser.id )
			equal( user.id, mockUser.id )
		} )

		events.on( 'disconnect', ( chat, user ) => {
			equal( chat.user_id, mockUser.id )
			equal( user.id, mockUser.id )
			done()
		} )

		watchForType( CUSTOMER_JOIN, action => {
			const { user, socket: { id: socket_id } } = action
			equal( user.id, mockUser.id )
			equal( socket_id, 'socket-id' )
			debug( 'disconnecting' )
			server.disconnect( { client, socket } )
		} )

		auth()
	} )

	it( 'should fail to authenticate with invalid token', ( done ) => {
		events.once( 'connection', ( _socket, authorize ) => authorize( new Error( 'nope' ) ) )
		client.on( 'unauthorized', () => done() )
		server.emit( 'connection', socket )
	} )

	describe( 'with multiple connections', () => {
		let connection2;
		beforeEach( ( next ) => {
			events = auth( () => {
				connection2 = server.connectNewClient( undefined, () => next() )
			} )
		} )

		it( 'should not fire disconnect until all clients leave', ( done ) => {
			events.once( 'disconnect', () => {
				server.in( `session/${ mockUser.session_id }` ).clients( ( e, clients ) => {
					equal( clients.length, 0 )
					done()
				} )
			} )

			watchForType( CUSTOMER_JOIN, () => {
				server.in( `session/${ mockUser.session_id }` ).clients( ( e, clients ) => {
					equal( clients.length, 2 )

					server.disconnect( { client, socket } )
					server.disconnect( { client: connection2.client, socket: connection2.socket } )
				} )
			} )
		} )
	} )
} )
