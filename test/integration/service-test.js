import { createServer } from 'http'
import { equal } from 'assert'
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

	const initClient = () => new Promise( ( resolve, reject ) => {
		const client = new IO( 'http://localhost:61616/customer' )
		client.once( 'init', () => resolve( client ) )
		client.once( 'unauthorized', reject )
	} )

	const startAgent = () => new Promise( ( resolve, reject ) => {
		const agent = new IO( 'http://localhost:61616/agent' )
		agent.once( 'unauthorized', reject )
		agent.once( 'init', () => resolve( agent ) )
	} )

	const initClientAndAgent = () => new Promise( ( resolve, reject ) => {
		initClient().then( ( client ) => startAgent().then( ( agent ) => {
			resolve( { client, agent } )
		} ) )
		.catch( reject )
	} )

	before( ( done ) => server.listen( 61616, done ) )
	after( () => server.close() )

	it( 'should allow agent to communicate with user', () => initClientAndAgent().then(
		( { client, agent } ) => new Promise( ( resolve, reject ) => {
			agent.once( 'message', ( { context, text, id } ) => {
				equal( id, 'message-1' )
				agent.emit( 'message', { id: 'message-2', context, text: `re: ${text}`, user: botUser } )
			} )
			client.once( 'message', ( { id } ) => {
				equal( id, 'message-1' )
				client.once( 'message', ( { id: next_id, text } ) => {
					equal( next_id, 'message-2' )
					equal( text, 're: hello' )
					client.close()
					agent.close()
					resolve()
				} )
			} )
			client.emit( 'message', { text: 'hello', id: 'message-1' } )
		} )
	) )
} )
