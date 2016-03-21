import customer from '../../lib/customer'
import mockIO from '../mock-io'
import { contains, ok, equal, deepEqual } from '../assert'

const debug = require( 'debug' )( 'tinkerchat:test:customer' )

// const authorizeAndInit = ( { client, server, socket, user} ) => ( next = () => {} ) => {
// 	client.on( 'init', () => next() )
// 	let events = customer( server, ( token, callback ) => callback( null, user ) )
// 	process.nextTick( () => {
// 		server.emit( 'connection', socket )
// 		client.emit( 'token', 'hello' )
// 	} )
// 	return events
// }

describe( 'Customer Service', () => {
	let server, socket, client, customerEvents
	const mockUser = { id: 'abdefgh', username: 'ridley', displayName: 'Ridley', avatarURL: 'http://example.com/image' }
	let auth
	beforeEach( () => {
		( { server, socket, client } = mockIO() )
		auth = ( next = () => {} ) => {
			let events = customer( server ).on( 'connection', ( _socket, authUser ) => {
				authUser( null, mockUser )
				client.on( 'init', () => next() )
			} )
			server.emit( 'connection', socket )
			return events
		}
	} )

	describe( 'with authorized user', () => {
		beforeEach( ( next ) => {
			customerEvents = auth( next )
		} )

		it( 'should receive message and broadcast it', ( done ) => {
			server.once( `${mockUser.id}.message`, ( { id, text, timestamp, user, meta } ) => {
				equal( id, 'message-id' )
				ok( timestamp )
				ok( meta )
				equal( text, 'hello world' )
				deepEqual( user, {
					id: mockUser.id,
					displayName: mockUser.displayName,
					avatarURL: mockUser.avatarURL
				} )
				done()
			} )
			client.emit( 'message', { id: 'message-id', text: 'hello world' } )
		} )

		it( 'should receive message via event', ( done ) => {
			server.once( 'fake-user.message', () => {
				done()
			} )
			customerEvents.emit( 'receive', { context: 'fake-user', text: 'hello', user: { id: 'fake-user-id' } } )
		} )
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

	it( 'should emit connection', ( done ) => {
		const customers = customer( server )
		customers.on( 'connection', () => {
			done()
		} )
		server.emit( 'connection', socket )
	} )

	it( 'should authenticate and init client', ( done ) => {
		customer( server ).once( 'connection', ( _socket, authUser ) => {
			authUser( null, { id: 'user1', username: 'user1' } )
		} )

		client.once( 'init', () => {
			debug( 'socket rooms', socket.rooms )
			contains( socket.rooms, 'user1' )
			done()
		} )

		server.emit( 'connection', socket )
	} )

	it( 'should notify user join and leave', ( done ) => {
		socket.id = 'socket-id'
		let events = auth()
		events.on( 'join', ( { id, socket_id } ) => {
			equal( id, mockUser.id )
			equal( socket_id, 'socket-id' )

			events.on( 'leave', ( { id: left_id, socket_id: left_socket_id } ) => {
				equal( left_id, mockUser.id )
				equal( left_socket_id, 'socket-id' )
				done()
			} )
			client.emit( 'disconnect' )
		} )
	} )

	it( 'should fail to authenticate with invalid token', ( done ) => {
		customer( server ).once( 'connection', ( _socket, authorize ) => authorize( new Error( 'nope' ) ) )
		client.on( 'unauthorized', () => done() )
		server.emit( 'connection', socket )
	} )
} )
