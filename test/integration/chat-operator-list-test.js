import { equal, deepEqual } from 'assert'
import { series } from 'async'
import { map, forEach } from 'lodash/collection'
import { get } from 'lodash/object'
import makeService, { setClientCapacity } from './helpers'
import { keys } from 'ramda'

const debug = require( 'debug' )( 'happychat:test:integration' )

const prop = ( name, fallback = undefined ) => ( obj ) => get( obj, name, fallback )

const noop = () => {}
describe( 'Operators in chat', () => {
	let operators = [
		{ id: 'operator-1', username: 'op1', displayName: 'op1', picture: '', capacity: 5 },
		{ id: 'operator-2', username: 'op2', displayName: 'op2', picture: '', capacity: 4 },
		{ id: 'operator-3', username: 'op3', displayName: 'op3', picture: '', capacity: 3 }
	]

	var operatorClients;

	let customer = {
		id: 'customer',
		username: 'customer',
		displayName: 'Customer',
		picture: '',
		session_id: 'session'
	}

	const service = makeService( {
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
				setClientCapacity( client, operator.capacity ).then( () => callback( null, client ) )
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
		setTimeout( () => {
			client.emit( 'broadcast.state', ( version, state ) => {
				debug( 'received state', state.locales.memberships )
				const [ , , , , members ] = state.chatlist.session
				resolve( keys( members ) )
			} )
		}, 100 )
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
		client.once( 'disconnect', () => resolve() )
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
			return joinChat( client, customer.session_id )
			.then( () => waitForChatOperatorList( client ) )
		} )
		// when an operator joins a chat, updated operator list should be sent
		.then( ( list ) => {
			deepEqual( list, ['operator-1', 'operator-3'] )
			const client = operatorClients.slice( -1 )[0]

			debug( 'listen for operator leaving' )
			return leaveChat( client, customer.session_id )
			.then( () => waitForChatOperatorList( operatorClients[0] ) )
		} )
		// when an operator leaves a chat, updated operator list should be sent
		.then( ( list ) => {
			deepEqual( list, map( operators.slice( 0, 1 ), prop( 'id' ) ) )
		} )
		.then( () => joinChat( operatorClients[1], customer.session_id ) )
		.then( () => waitForChatOperatorList( operatorClients[1] ) )
		.then( () => disconnectClient( operatorClients[1] ) )
		.then( () => waitForChatOperatorList( operatorClients[0] ) )
		.then( ( list ) => {
			deepEqual( list, [ 'operator-1' ] )
		} )
	} )
} )
