import customer from '../../lib/customer'
import { ok, equal } from 'assert'
import { EventEmitter } from 'events'

describe( 'customer service', () => {
	let server, socket, client

	beforeEach( () => {
		server = new EventEmitter()
		socket = new EventEmitter()
		client = new EventEmitter()
		let emitClient = client.emit.bind( client )
		let emitSocket = socket.emit.bind( socket )
		socket.emit = emitClient
		client.emit = emitSocket
	} )

	describe( 'with authorized user', () => {
		beforeEach( ( next ) => {
			client.on( 'init', () => next() )
			customer( server, ( token, callback ) => callback( null, { id: 'abdefgh' } ) )
			server.emit( 'connection', socket )
			client.emit( 'token', 'hello' )
		} )

		it( 'should receive message and broadcast it', ( done ) => {
			client.once( 'message', ( message ) => {
				equal( message, 'hello world' )
				done()
			} )
			client.emit( 'message', 'hello world' )
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
			client.once( 'init', () => done() )
			callback( null, { id: 'user1' } )
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
