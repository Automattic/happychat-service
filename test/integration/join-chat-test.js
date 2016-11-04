import { ok, deepEqual } from 'assert'
import util, { authenticators } from './util'

const debug = require( 'debug' )( 'happychat:test:join-chat' )

describe( 'Operator', () => {
	let mockUser = {
		id: 'fake-user-id',
		displayName: 'Nasuicaä',
		username: 'nausicaa',
		avatarURL: 'http://example.com/nausicaa',
		session_id: 'session-id'
	}
	let opUser = {
		id: 'operator-id',
		displayName: 'Ridley',
		username: 'ridley',
		avatarURL: 'http://sample.com/ridley'
	}

	let service;

	const emitCustomerMessage = ( { customer, operator } ) => new Promise( ( resolve ) => {
		customer.on( 'message', () => {
			debug( 'customer received message?' )
			resolve( { customer, operator } )
		} )
		customer.emit( 'message', { id: 'message', text: 'hello' } )
	} )

	const operatorJoinChat = ( { operator } ) => new Promise( ( resolve ) => {
		debug( 'operator is joining chat' )
		operator.on( 'chat.open', ( chat ) => {
			resolve( chat )
		} )
		operator.emit( 'chat.join', mockUser.session_id )
	} )

	const leaveChat = ( client, chat_id ) => new Promise( ( resolve ) => {
		client.once( 'chat.leave', ( chat ) => resolve( { client, chat } ) )
		client.emit( 'chat.leave', chat_id )
	} )

	beforeEach( () => {
		service = util( authenticators( mockUser, opUser, {} ) )
		service.start()
	} )
	afterEach( () => service.stop() )

	it( 'should join chat', () => service.startClients()
		.then( emitCustomerMessage )
		.then( operatorJoinChat )
	.then( chat => {
		ok( chat )
		debug( 'check the store', service.service.store.getState().chatlist['session-id'] )
	} )
	)

	describe( 'when in a chat', () => {
		let operator

		beforeEach( () => service.startClients()
			.then( ( clients ) => {
				operator = clients.operator
				return Promise.resolve( clients )
			} )
			.then( emitCustomerMessage )
			.then( operatorJoinChat )
		)

		it( 'should leave chat', () => leaveChat( operator, mockUser.session_id )
			.then( ( { chat: { id } } ) => {
				deepEqual( id, mockUser.session_id )
			} )
		)
	} )
} )
