import { equal } from 'assert'
import util, { authenticators } from './util'

const debug = require( 'debug' )( 'tinkerchat:test:service' )

describe( 'Service', () => {
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

	const service = util( authenticators( mockUser, { id: 'operator-id' }, botUser ) )

	before( () => service.start() )
	after( () => service.stop() )
	it( 'should allow agent to communicate with user', () => service.startClients().then(
		( { customer, agent } ) => new Promise( ( resolve ) => {
			debug( 'time to test customer' )
			agent.once( 'message', ( { context, text, id } ) => {
				equal( id, 'message-1' )
				agent.emit( 'message', { id: 'message-2', context, text: `re: ${text}`, user: botUser } )
			} )
			customer.once( 'message', ( { id } ) => {
				equal( id, 'message-1' )
				customer.once( 'message', ( { id: next_id, text } ) => {
					equal( next_id, 'message-2' )
					equal( text, 're: hello' )
					customer.close()
					agent.close()
					resolve()
				} )
			} )
			customer.emit( 'message', { text: 'hello', id: 'message-1' } )
		} )
	) )
} )
