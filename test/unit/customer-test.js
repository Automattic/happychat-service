import { createStore } from 'redux'
import mockIO from '../mock-io'
import { contains, ok, equal, deepEqual } from '../assert'
import enhancer from 'state'
import { reducer } from 'service'
import WatchingMiddleware from '../mock-middleware'
import {
	CUSTOMER_TYPING,
	CUSTOMER_INBOUND_MESSAGE,
	CUSTOMER_JOIN,
	CUSTOMER_SOCKET_DISCONNECT,
	CUSTOMER_DISCONNECT,
	customerReceiveTyping,
	customerReceiveMessage
} from 'state/chatlist/actions'

const debug = require( 'debug' )( 'happychat:test:customer' )

describe( 'Customer Service', () => {
	let server, socket, client, watching, store, auth, connectUser
	const mockUser = {
		id: 'abdefgh',
		username: 'ridley',
		name: 'Ridley',
		picture: 'http://example.com/image',
		session_id: 'abdefgh-chat'
	}
	const watchForType = ( ... args ) => watching.watchForType( ... args )
	let doAuth = () => auth( socket )

	beforeEach( () => {
		// export default ( { io, customers, operators, chatlist, middlewares = [], timeout = undefined }, state ) => createStore(
		const { server: io } = mockIO()
		watching = new WatchingMiddleware()
		store = createStore( reducer, enhancer( {
			io: io,
			customerAuth: doAuth,
			timeout: 10,
			middlewares: [ watching.middleware() ]
		} ) )
		server = io.of( '/customer' )
		auth = () => Promise.resolve( mockUser );
		( { client, socket } = server.newClient() );
		connectUser = ( next = () => {} ) => {
			// customer( customerIO, customerEvents )
			client.on( 'init', () => next() )
			server.emit( 'connection', socket )
		}
	} )

	describe( 'with authorized user', () => {
		beforeEach( ( next ) => {
			connectUser( next )
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

	it( 'should authenticate and init client', ( done ) => {
		auth = () => Promise.resolve( { id: 'user1', username: 'user1', session_id: 'session' } )

		client.once( 'init', () => {
			contains( socket.rooms, 'customer/session' )
			done()
		} )

		server.emit( 'connection', socket )
	} )

	it( 'should notify user join and leave', ( done ) => {
		socket.id = 'socket-id'
		let disconnectSocketFired = false
		watchForType( CUSTOMER_SOCKET_DISCONNECT, action => {
			const { chat, socket: s, user } = action
			disconnectSocketFired = true
			equal( user.id, mockUser.id )
			equal( s.id, 'socket-id' )
			equal( chat.user_id, mockUser.id )
		} )

		watchForType( CUSTOMER_DISCONNECT, action => {
			const { chat, user } = action
			equal( chat.user_id, mockUser.id )
			equal( user.id, mockUser.id )
			ok( disconnectSocketFired )
			done()
		} )

		watchForType( CUSTOMER_JOIN, action => {
			const { user, socket: { id: socket_id } } = action
			equal( user.id, mockUser.id )
			equal( socket_id, 'socket-id' )
			debug( 'disconnecting' )
			server.disconnect( { client, socket } )
		} )

		connectUser()
	} )

	describe( 'with multiple connections', () => {
		let connection2;
		beforeEach( ( next ) => {
			connectUser( () => {
				connection2 = server.connectNewClient( undefined, () => next() )
			} )
		} )

		it( 'should not fire disconnect until all clients leave', ( done ) => {
			watchForType( CUSTOMER_DISCONNECT, () => {
				server.in( `customer/${ mockUser.session_id }` ).clients( ( e, clients ) => {
					equal( clients.length, 0 )
					done()
				} )
			} )

			watchForType( CUSTOMER_JOIN, () => {
				server.in( `customer/${ mockUser.session_id }` ).clients( ( e, clients ) => {
					equal( clients.length, 2 )
					client.disconnect()
					process.nextTick( () => connection2.client.disconnect() )
				} )
			} )
		} )
	} )
} )
