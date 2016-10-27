import { ok, equal } from 'assert'
import util, { authenticators } from './util'

const debug = require( 'debug' )( 'happychat:test:integration' )

process.on( 'unhandledRejection', ( e ) => {
	debug( 'unhandled rejection', e )
} )

describe( 'Abandoned service', () => {
	let mockUser = {
		id: 'mock-user-id',
		displayName: 'Nasuicaä',
		username: 'nausicaa',
		avatarURL: 'http://example.com/nausicaa',
		session_id: 'mock-session-id'
	}
	let opUser = {
		id: 'operator-id',
		displayName: 'Ridley',
		username: 'ridley',
		avatarURL: 'http://sample.com/ridley'
	}

	const service = util( authenticators( mockUser, opUser, {} ) )

	const setOperatorStatus = ( { operator, customer }, status = 'online' ) => new Promise( ( resolve ) => {
		operator.emit( 'status', status, () => {
			debug( `operator is ${ status }` )
			resolve( { operator, customer } )
		} )
	} )

	const assignOperator = ( { customer, operator } ) => new Promise( ( resolve ) => {
		operator.once( 'available', ( chat, callback ) => {
			callback( { capacity: 1, status: 'available', load: 0 } )
		} )
		operator.once( 'chat.open', ( chat ) => {
			resolve( { customer, operator, chat } )
		} )
		customer.emit( 'message', { text: 'help', id: 'message-1' } )
	} )

	const reconnectOperator = ( { operator } ) => new Promise( ( resolve ) => {
		operator.once( 'disconnect', () => {
			debug( 'disconnected and reconnecting' )
			operator.once( 'connect', () => debug( 'reconnected' ) )
			operator.connect()
		} )
		operator.once( 'chat.open', ( chat ) => {
			debug( 'chat reopend' )
			resolve( chat )
		} )
		operator.disconnect()
	} )

	before( () => service.start() )
	after( () => service.stop() )

	it( 'recover abandoned chats', () => service.startClients()
	.then( setOperatorStatus )
	.then( assignOperator )
	.then( reconnectOperator )
	.then( ( chat ) => new Promise( ( resolve ) => {
		equal( chat.id, mockUser.session_id )
		resolve()
	} ) ) )
} )
