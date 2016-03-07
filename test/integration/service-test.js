import { createServer } from 'http'
import { fail } from 'assert'
import service from '../../lib/service'
import IO from 'socket.io-client'

const debug = require( 'debug' )( 'tinkerchat:test:integration' )

describe( 'Service', () => {
	let server = createServer()
	let mockUser = {
		id:          'fake-user-id',
		displayName: 'Nasuicaä',
		username:    'nausicaa',
		avatarURL:   'http://example.com/nausicaa'
	}
	let customerAuthenticator = ( token, callback ) => {
		debug( 'authorize client', token )
		if ( token !== 'abcdefg' ) callback( new Error( 'invalid token' ) )
		callback( null, mockUser )
	}
	let agentAuthenticator = ( callback ) => {
		debug( 'authenticating agent' )
		callback( null, {} )
	}
	service( server, { customerAuthenticator, agentAuthenticator } )

	before( ( done ) => {
		server.listen( 61616, () => done() )
	} )

	it( 'should connect a user', ( done ) => {
		const client = new IO( 'http://localhost:61616/customer' )
		const startAgent = () => {
			const agent = new IO( 'http://localhost:61616/agent' )
			agent.on( 'unauthorized', () => fail( 'failed to authorize agent' ) )
			agent.on( 'init', () => {
				// TODO: check for existing clients?
				done()
			} )
		}

		client.on( 'token', () => {
			debug( 'token requested' )
			client.emit( 'token', 'abcdefg' )
		} )
		client.on( 'init', () => startAgent() )
		client.on( 'unauthorized', () => fail( 'failed to authorize client' ) )
	} )
} )
