import { ok, deepEqual } from 'assert'
import util, { authenticators } from './util'

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

	const operatorJoinChat = ( { operator } ) => new Promise( ( resolve ) => {
		operator.on( 'chat.open', ( chat ) => {
			resolve( chat )
		} )
		operator.emit( 'chat.join', 'fake-user-id' )
	} )

	const leaveChat = ( client, chat_id ) => new Promise( ( resolve ) => {
		client.once( 'chat.leave', ( chat ) => resolve( { client, chat } ) )
		client.emit( 'chat.leave', chat_id )
	} )

	beforeEach( () => service.start() )
	afterEach( () => service.stop() )

	it( 'should join chat', () => service.startClients()
	.then( emitCustomerMessage )
	.then( operatorJoinChat )
	.then( ( chat ) => {
		ok( chat )
	} ) )

	describe( 'when in a chat', () => {
		var operator

		beforeEach( () => service.startClients()
			.then( ( clients ) => {
				operator = clients.operator
				return Promise.resolve( clients )
			} )
			.then( emitCustomerMessage )
			.then( operatorJoinChat )
		)

		it( 'should leave chat', () => leaveChat( operator, 'fake-user-id' )
			.then( ( { chat: { id } } ) => {
				deepEqual( id, 'fake-user-id' )
			} )
		)
	} )
} )
