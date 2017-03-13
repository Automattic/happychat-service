import { ok, equal, deepEqual } from 'assert'
import mockIO from '../mock-io'
import agentMiddleware from 'state/middlewares/socket-io/agents'
import { AGENT_INBOUND_MESSAGE, AGENT_SYSTEM_INFO } from 'state/action-types'
import { agentReceiveMessage } from 'state/chatlist/actions'

const debug = require( 'debug' )( 'happychat:test:agent' )

describe( 'Agent Service', () => {
	let socket, client, io
	const noop = () => {}

	beforeEach( () => {
		( { server: io, socket, client } = mockIO() )
	} )

	describe( 'when authenticated', () => {
		let lastDispatch, state, middleware
		beforeEach( ( next ) => {
			middleware = agentMiddleware( io, () => Promise.resolve( 'agent' ) )( {
				dispatch: ( action ) => {
					lastDispatch = action
				},
				getState: () => state
			} )

			client.once( 'connect', () => {
				client.once( 'init', () => next() )
			} )
			client.connect()
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
			client.on( 'message', ( { id, timestamp, text, session_id, author_id, author_type, type } ) => {
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

		it( 'should handle system.info event', () => {
			state = {
				operators: { identities: { a: 'a' } },
				chatlist: { id: [ 'status', 'a-chat' ] }
			}

			client.emit( 'system.info' )
			ok( lastDispatch.type )
			deepEqual( lastDispatch, { type: AGENT_SYSTEM_INFO, socketId: socket.id } )
		} )
	} )

	it( 'should initialize service', ( done ) => {
		debug( 'io', io.on )
		agentMiddleware( io, () => Promise.resolve( 'agent' ) )( { dispatch: noop, getState: noop } )
		client.on( 'init', () => done() )
		io.emit( 'connection', socket )
	} )
} )
