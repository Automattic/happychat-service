import { equal } from 'assert'
import util, { authenticators } from './util'

const debug = require( 'debug' )( 'happychat:test:integration:typing' )

describe( 'Integration: Typing', () => {
	const operator = {
		id: 'operator-id',
		displayName: 'Operator',
		username: 'operator',
		avatarURL: 'http://example.com/avatar'
	}

	const customer = {
		id: 'customer-id',
		username: 'customer',
		session_id: 'customer-session'
	}

	let service
	let customerClient
	let operatorClient

	const initChat = () => {
		return service.startClients()
			.then( clients => {
				customerClient = clients.customer
				operatorClient = clients.operator
				return Promise.resolve( clients )
			} )
			.then( clients => new Promise( resolve => {
				debug( 'setup: send customer message for chat assignment' )
				clients.customer.on( 'message', () => resolve( clients ) )
				clients.customer.emit( 'message', { id: 'message', text: 'hello' } )
			} ) )
			.then( clients => new Promise( resolve => {
				debug( 'setup: operator join' )
				clients.operator.on( 'chat.open', chat => resolve( chat ) )
				clients.operator.emit( 'chat.join', customer.session_id )
			} ) )
	}

	beforeEach( () => {
		service = util( authenticators( customer, operator, {} ) )
		service.start()
	} )

	afterEach( () => {
		service.stop()
	} )

	it( 'should send customer `typing` event to operator', ( done ) => {
		initChat()
			.then( ( chat ) => {
				operatorClient.once( 'chat.typing', ( { id: chat_id }, user, text ) => {
					equal( chat.id, chat_id )
					equal( user.id, customer.id )
					equal( text, 'I am typing' )
					done()
				} )

				customerClient.emit( 'typing', 'I am typing' );
			} )
	} )

	it( 'should send operator `typing` event to customer', ( done ) => {
		initChat()
			.then( ( chat ) => {
				customerClient.once( 'typing', isTyping => {
					equal( isTyping, true )
					done()
				} )

				operatorClient.emit( 'chat.typing', chat.id, 'I am typing' );
			} )
	} )
} )
