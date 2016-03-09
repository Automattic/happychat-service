import customer from '../../lib/customer'
import mockIO from '../mock-io'
import { contains, ok, equal, deepEqual } from '../assert'

const debug = require( 'debug' )( 'tinkerchat:test:customer' )

describe( 'Customer Service', () => {
	let server, socket, client, customerEvents

	beforeEach( () => {
		( { server, socket, client } = mockIO() )
	} )

	describe( 'with authorized user', () => {
		const mockUser = { id: 'abdefgh', username: 'ridley', displayName: 'Ridley', avatarURL: 'http://example.com/image' }
		beforeEach( ( next ) => {
			client.on( 'init', () => next() )
			customerEvents = customer( server, ( token, callback ) => callback( null, mockUser ) )
			server.emit( 'connection', socket )
			client.emit( 'token', 'hello' )
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
			customerEvents.emit( 'send', { context: 'fake-user', text: 'hello', user: { id: 'fake-user-id' } } )
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

	it( 'should request a token', ( done ) => {
		client.on( 'token', () => done() )

		customer( server )
		server.emit( 'connection', socket )
	} )

	it( 'should authenticate and init client', ( done ) => {
		customer( server, ( token, callback ) => {
			equal( typeof( callback ), 'function' )
			equal( token, 'valid' )
			client.once( 'init', () => {
				debug( 'socket rooms', socket.rooms )
				contains( socket.rooms, 'user1' )
				done()
			} )
			callback( null, { id: 'user1', username: 'user1' } )
		} )

		server.emit( 'connection', socket )
		client.emit( 'token', 'valid' )
	} )

	it( 'should fail to authenticate with invalid token', ( done ) => {
		customer( server, ( token, callback ) => {
			client.once( 'unauthorized', () => done() )
			callback( new Error( 'Invalid token' ) )
		} )
		server.emit( 'connection', socket )
		client.emit( 'token', 'invalid' )
	} )
} )
