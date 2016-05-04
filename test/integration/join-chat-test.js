import { ok, equal } from 'assert'
import util, { authenticators } from './util'

const debug = require( 'debug' )( 'tinkerchat:test:integration' )

describe( 'Operator', () => {
	let mockUser = {
		id: 'fake-user-id',
		displayName: 'Nasuicaä',
		username: 'nausicaa',
		avatarURL: 'http://example.com/nausicaa'
	}
	let opUser = {
		id: 'operator-id',
		displayName: 'Ridley',
		username: 'ridley',
		avatarURL: 'http://sample.com/ridley'
	}

	const service = util( authenticators( mockUser, opUser, {} ) )

	const emitCustomerMessage = ( { customer, operator } ) => new Promise( ( resolve ) => {
		customer.on( 'message', () => {
			resolve( { customer, operator } )
		} )
		customer.emit( 'message', { id: 'message', text: 'hello' } )
	} )

	const operatorJoinChat = ( { customer, operator } ) => new Promise( ( resolve ) => {
		operator.on( 'chat.open', ( chat ) => {
			resolve( chat )
		} )
		operator.emit( 'chat.join', 'fake-user-id' )
	} )

	before( () => service.start() )
	after( () => service.stop() )

	it( 'should join chat', () => service.startClients()
	.then( emitCustomerMessage )
	.then( operatorJoinChat )
	.then( ( chat ) => {
		ok( chat )
	} ) )
} )
