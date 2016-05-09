import { equal, deepEqual } from 'assert'
import { series } from 'async'
import { map, forEach } from 'lodash/collection'
import { get } from 'lodash/object'
import util from './util'

const debug = require( 'debug' )( 'tinkerchat:test:integration' )

const prop = ( name, fallback = undefined ) => ( obj ) => get( obj, name, fallback )

const noop = () => {}
describe( 'Operators in chat', () => {
	let operators = [
		{ id: 'operator-1' },
		{ id: 'operator-2' }
	]

	var operatorClients;

	let customer = { id: 'customer', displayName: 'Customer' }

	const service = util( {
		operatorAuthenticator: ( ( users ) => ( socket, callback ) => {
			const [user, ... rest] = users
			debug( 'authenticating user', user )
			callback( null, user )
			users = rest
		} )( operators ),
		customerAuthenticator: ( socket, callback ) => callback( null, customer ),
		agentAuthenticator: noop
	} )

	const waitForConnect = ( client ) => new Promise( ( resolve ) => {
		debug( 'client is connecting' )
		client.once( 'connect', () => {
			debug( 'client connected' )
			resolve( client )
		} )
	} )

	const connectAllOperators = () => new Promise( ( resolve ) => {
		series( map( operators, ( operator ) => ( callback ) => {
			service.startOperator()
			.then( waitForConnect )
			.then( ( client ) => {
				client.on( 'identify', ( identify ) => identify( operator ) )
				client.on( 'available', ( chat, available ) => {
					available( { capacity: 1, load: 0, id: operator.id } )
				} )
				callback( null, client )
			} )
		} ), ( e, clients ) => {
			operatorClients = clients
			resolve( clients )
		} )
	} )

	const openCustomerRequest = ( clients ) => new Promise( ( resolve, reject ) => {
		forEach( clients, ( client ) => {
			// when one of the clients is assigned to a chat
			client.once( 'chat.open', () => resolve( client ) )
		} )
		service.startCustomer()
		.then( ( client ) => {
			client.emit( 'message', { id: 'message-id', text: 'help' } )
		}, reject )
	} )

	const waitForChatOperatorList = ( client ) => new Promise( ( resolve ) => {
		debug( 'waiting for list' )
		client.once( 'chat.online', ( chat, list ) => resolve( list ) )
	} )

	const joinChat = ( client, chat_id ) => new Promise( ( resolve ) => {
		client.once( 'chat.open', ( chat ) => resolve( chat ) )
		client.emit( 'chat.join', chat_id )
	} )

	const leaveChat = ( client, chat_id ) => new Promise( ( resolve ) => {
		client.once( 'chat.leave', () => {
			debug( 'left' )
			resolve( client )
		} )
		client.emit( 'chat.leave', chat_id )
	} )

	const disconnectClient = ( client ) => new Promise( ( resolve ) => {
		client.cone( 'disconnect', () => resolve() )
		client.close()
	} )

	before( () => service.start() )
	after( () => service.stop() )

	it( 'get operator list for chat', () => {
		return connectAllOperators()
		.then( ( clients ) => {
			return openCustomerRequest( clients )
			.then( waitForChatOperatorList )
		} )
		// when a chat is assigned, operator should receive list of operators in chat
		.then( ( list ) => {
			equal( list.length, 1 )
			const client = operatorClients.slice( -1 )[0]
			return joinChat( client, 'customer' )
			.then( () => waitForChatOperatorList( client ) )
		} )
		// when an operator joins a chat, updated operator list should be sent
		.then( ( list ) => {
			deepEqual( map( list, prop( 'id' ) ), map( operators, prop( 'id' ) ) )
			const client = operatorClients.slice( -1 )[0]

			debug( 'listen for operator leaving' )
			return leaveChat( client, 'customer' )
			.then( () => waitForChatOperatorList( operatorClients[0] ) )
		} )
		// when an operator leaves a chat, updated operator list should be sent
		.then( ( list ) => {
			deepEqual( map( list, prop( 'id' ) ), map( operators.slice( 0, 1 ), prop( 'id' ) ) )
		} )
	} )
} )
