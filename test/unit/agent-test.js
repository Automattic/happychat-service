import { EventEmitter } from 'events'
import { ok, equal } from 'assert'
import mockIO from '../mock-io'
import agentMiddleware from 'middlewares/socket-io/agents'

const debug = require( 'debug' )( 'happychat:test:agent' )

describe( 'Agent Service', () => {
	let server, socket, client, io

	beforeEach( () => {
		( { server: io, socket, client } = mockIO() )
	} )

	describe( 'when authenticated', () => {
		let middleware, events
		beforeEach( ( next ) => {
			server = io.of( '/agent' )
			events = new EventEmitter()
			middleware = agentMiddleware( server, events )()
			events.on( 'connection', ( socket, auth ) => auth() )
			client.on( 'init', () => next() )
			server.emit( 'connection', socket )
		} )

		it( 'should emit message from customer', ( done ) => {
		/**
`message`: A message being sent and the context of the message
  - `id`: the id of the message
  - `timestamp`: timestampe of the message
  - `text`: content of the message
  - `context`: the id of the channel the message was sent to
  - `author_id`: the id of the author of the message
  - `author_type`: One of `customer`, `support`, `agent`
		 */
			server.on( 'message', ( { id, timestamp, text, session_id, author_id, author_type, type } ) => {
				equal( id, 'fake-message-id' )
				ok( timestamp )
				equal( text, 'hello' )
				equal( session_id, 'fake-context' )
				equal( author_id, 'fake-user-id' )
				equal( author_type, 'customer' )
				equal( type, 'message-type' )
				done()
			} )
			events.emit( 'receive', {
				id: 'fake-message-id',
				timestamp: ( new Date() ).getTime(),
				text: 'hello',
				session_id: 'fake-context',
				author_id: 'fake-user-id',
				author_type: 'customer',
				type: 'message-type'
			} )
		} )

		it( 'should send messsage to customer', ( done ) => {
			events.once( 'message', ( { id, text, session_id, timestamp } ) => {
				debug( 'help' )
				equal( id, 'fake-agent-message-id' )
				equal( text, 'hello' )
				equal( session_id, 'mock-user-context-id' )
				ok( timestamp )
				done()
			} )
			client.emit( 'message', {
				id: 'fake-agent-message-id',
				timestamp: ( new Date() ).getTime(),
				session_id: 'mock-user-context-id',
				text: 'hello',
				user: {
					id: 'agent-user-id',
					displayName: 'HAL-4000',
					avatarURL: 'http://example.com/image',
					username: 'agent-username'
				}
			} )
		} )

		it( 'should handle system.info event', ( done ) => {
			events.once( 'system.info', ( callback ) => {
				callback( { foo: 'bar' } )
			} )

			client.emit( 'system.info', ( data ) => {
				equal( data.foo, 'bar' )
				done()
			} )
		} )
	} )

	it( 'should initialize service', ( done ) => {
		let events = new EventEmitter()
		debug( 'io', io.on )
		agentMiddleware( io, events )()
		events.once( 'connection', ( _socket, auth ) => auth() )
		client.on( 'init', () => done() )
		io.emit( 'connection', socket )
	} )

	it( 'should emit unauthenticated when failing authentication', ( done ) => {
		let events = new EventEmitter()
		agentMiddleware( io, events )()
		events.once( 'connection', ( _socket, auth ) => auth( new Error( 'nope' ) ) )
		client.on( 'unauthorized', () => done() )
		io.emit( 'connection', socket )
	} )
} )
