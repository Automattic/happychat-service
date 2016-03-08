import { ok, equal } from 'assert'
import { EventEmitter } from 'events'
import mockIO from '../mock-io'
import agent from '../../lib/agent'

const debug = require( 'debug' )( 'tinkerchat:test:agent' )
const mockAuth = ( auth ) => auth( null, {} )
const mockCustomers = new EventEmitter()

describe( 'Agent Service', () => {
	let server, socket, client

	beforeEach( () => {
		( { server, socket, client } = mockIO() )
	} )

	describe( 'when authenticated', () => {
		beforeEach( ( done ) => {
			agent( server, { customers: mockCustomers, authenticator: mockAuth } )
			client.on( 'init', () => done() )
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
			client.on( 'message', ( { id, timestamp, text, context, author_id, author_type } ) => {
				equal( id, 'fake-message-id' )
				ok( timestamp )
				equal( text, 'hello' )
				equal( context, 'fake-user-id' )
				equal( author_id, 'fake-user-id' )
				equal( author_type, 'customer' )
				done()
			} )
			mockCustomers.emit( 'message', {
				id:        'fake-message-id',
				timestamp: ( new Date() ).getTime(),
				text:      'hello',
				user:      {
					id:          'fake-user-id',
					displayName: 'Furiousa',
					avatarURL:   'http://example.com/image',
				},
				meta: {}
			} )
		} )
	} )

	it( 'should initilize service', ( done ) => {
		agent( server, { authenticator: mockAuth, customers: mockCustomers } )
		client.on( 'init', () => done() )
		server.emit( 'connection', socket )
	} )

	it( 'should emit unauthenticated when failing authentication', ( done ) => {
		agent( server, { authenticator: ( auth ) => {
			debug( 'authenticating service' )
			auth( new Error( 'nope' ) )
		} } )
		client.on( 'unauthorized', () => done() )
		server.emit( 'connection', socket )
	} )
} )
