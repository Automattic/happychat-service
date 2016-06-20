import { ok, equal } from 'assert'
import mockIO from '../mock-io'
import agent from '../../src/agent'

const debug = require( 'debug' )( 'happychat:test:agent' )

describe( 'Agent Service', () => {
	let server, socket, client

	beforeEach( () => {
		( { server, socket, client } = mockIO() )
	} )

	describe( 'when authenticated', () => {
		let service
		beforeEach( ( next ) => {
			service = agent( server ).once( 'connection', ( _, auth ) => auth() )
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
			server.on( 'message', ( { id, timestamp, text, session_id, author_id, author_type } ) => {
				equal( id, 'fake-message-id' )
				ok( timestamp )
				equal( text, 'hello' )
				equal( session_id, 'fake-context' )
				equal( author_id, 'fake-user-id' )
				equal( author_type, 'customer' )
				done()
			} )
			service.emit( 'receive', {
				id: 'fake-message-id',
				timestamp: ( new Date() ).getTime(),
				text: 'hello',
				session_id: 'fake-context',
				author_id: 'fake-user-id',
				author_type: 'customer'
			} )
		} )

		it( 'should send messsage to customer', ( done ) => {
			service.once( 'message', ( { id, text, session_id, timestamp } ) => {
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
	} )

	it( 'should initilize service', ( done ) => {
		agent( server ).once( 'connection', ( _socket, auth ) => auth() )

		client.on( 'init', () => done() )
		server.emit( 'connection', socket )
	} )

	it( 'should emit unauthenticated when failing authentication', ( done ) => {
		agent( server ).once( 'connection', ( _socket, auth ) => auth( new Error( 'nope' ) ) )
		client.on( 'unauthorized', () => done() )
		server.emit( 'connection', socket )
	} )
} )
