import { createServer } from 'http'
import { fail, equal } from 'assert'
import service from '../../src/service'
import IO from 'socket.io-client'

const debug = require( 'debug' )( 'tinkerchat:test:integration' )

describe( 'Service', () => {
	let server = createServer()
	let mockUser = {
		id: 'fake-user-id',
		displayName: 'Nasuicaä',
		username: 'nausicaa',
		avatarURL: 'http://example.com/nausicaa'
	}
	let botUser = {
		id: 'imperator',
		dispayName: 'Furiosa',
		username: 'furiosa',
		avatarURL: 'http://example.com/furiousa'
	}
	let customerAuthenticator = ( socket, callback ) => {
		debug( 'authorize client' )
		callback( null, mockUser )
	}
	let agentAuthenticator = ( socket, callback ) => {
		debug( 'authenticating agent' )
		callback( null, {} )
	}
	let operatorAuthenticator = () => {
	}
	service( server, { customerAuthenticator, agentAuthenticator, operatorAuthenticator } )

	before( ( done ) => {
		debug( 'listening' )
		server.listen( 61616, () => done() )
	} )

	after( () => {
		server.close()
	} )

	it( 'should allow agent to communicate with user', ( done ) => {
		const client = new IO( 'http://localhost:61616/customer' )
		const startAgent = () => {
			const agent = new IO( 'http://localhost:61616/agent' )
			agent.once( 'unauthorized', () => fail( 'failed to authorize agent' ) )
			agent.once( 'init', () => {
				agent.once( 'message', ( { context, text, id } ) => {
					equal( id, 'message-1' )
					agent.emit( 'message', { id: 'message-2', context, text: `re: ${text}`, user: botUser } )
				} )
				client.once( 'message', ( { id } ) => {
					equal( id, 'message-1' )
					client.once( 'message', ( { id: next_id, text } ) => {
						equal( next_id, 'message-2' )
						equal( text, 're: hello' )
						done()
					} )
				} )
				client.emit( 'message', { text: 'hello', id: 'message-1' } )
			} )
		}

		client.on( 'init', () => startAgent() )
		client.on( 'unauthorized', () => fail( 'failed to authorize client' ) )
	} )
} )
