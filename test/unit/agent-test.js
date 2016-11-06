import { EventEmitter } from 'events'
import { ok, equal, deepEqual } from 'assert'
import mockIO from '../mock-io'
import agentMiddleware from 'middlewares/socket-io/agents'
import { AGENT_INBOUND_MESSAGE, agentReceiveMessage } from 'chat-list/actions'

const debug = require( 'debug' )( 'happychat:test:agent' )

describe( 'Agent Service', () => {
	let server, socket, client, io
	const noop = () => {}

	beforeEach( () => {
		( { server: io, socket, client } = mockIO() )
	} )

	describe( 'when authenticated', () => {
		let events, lastDispatch, state, middleware
		beforeEach( ( next ) => {
			server = io.of( '/agent' )
			events = new EventEmitter()
			middleware = agentMiddleware( server, events )( {
				dispatch: ( action ) => {
					lastDispatch = action
				},
				getState: () => state
			} )
			events.on( 'connection', ( _socket, auth ) => auth( null, 'agent' ) )
			client.on( 'init', () => next() )
			server.emit( 'connection', socket )
		} )

		it( 'should emit message from customer', ( done ) => {
			const message = {
				id: 'fake-message-id',
				timestamp: ( new Date() ).getTime(),
				text: 'hello',
				session_id: 'fake-context',
				author_id: 'fake-user-id',
				author_type: 'customer',
				type: 'message-type'
			}
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

			middleware( noop )( agentReceiveMessage( message ) )
		} )

		it( 'should send messsage to customer', () => {
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

			const { type, message: {
				id, text, session_id, timestamp
			} } = lastDispatch
			equal( type, AGENT_INBOUND_MESSAGE )
			equal( id, 'fake-agent-message-id' )
			equal( text, 'hello' )
			equal( session_id, 'mock-user-context-id' )
			ok( timestamp )
		} )

		it( 'should handle system.info event', ( done ) => {
			state = {
				operators: { identities: { a: 'a' } },
				chatlist: { id: [ 'status', 'a-chat' ] }
			}

			client.emit( 'system.info', ( data ) => {
				deepEqual( data, { chats: [ 'a-chat' ], operators: [ 'a' ] } )
				done()
			} )
		} )
	} )

	it( 'should initialize service', ( done ) => {
		let events = new EventEmitter()
		debug( 'io', io.on )
		agentMiddleware( io, events )( { dispatch: noop, getState: noop } )
		events.once( 'connection', ( _socket, auth ) => auth() )
		client.on( 'init', () => done() )
		io.emit( 'connection', socket )
	} )

	it( 'should emit unauthenticated when failing authentication', ( done ) => {
		let events = new EventEmitter()
		agentMiddleware( io, events )( { dispatch: noop, getState: noop } )
		events.once( 'connection', ( _socket, auth ) => auth( new Error( 'nope' ) ) )
		client.on( 'unauthorized', () => done() )
		io.emit( 'connection', socket )
	} )
} )
