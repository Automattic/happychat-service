import { equal, deepEqual } from 'assert'
import { series, parallel } from 'async'
import { map, forEach } from 'lodash/collection'
import util from './util'

const debug = require( 'debug' )( 'tinkerchat:test:integration' )

const noop = () => {}
describe( 'Operators in chat', () => {
	let operators = [
		{ id: 'operator-1' },
		{ id: 'operator-2' }
	]

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
					debug( 'available?', chat.id, operator.id )
					available( { capacity: 1, load: 0, id: operator.id } )
				} )
				callback( null, client )
			} )
		} ), ( e, clients ) => {
			resolve( clients )
		} )
	} )

	const disconnectOperator = ( clients ) => new Promise( ( resolve ) => {
		const [ client, ... rest ] = clients
		client.on( 'disconnect', () => {
			resolve( rest )
		} )
		client.close()
	} )

	const waitForList = ( clients ) => new Promise( ( resolve ) => {
		parallel( map( clients, ( client ) => ( callback ) => {
			client.once( 'operators.online', ( list ) => {
				callback( null, list )
			} )
		} ), ( e, lists ) => {
			resolve( { clients, lists } )
		} )
	} )

	const openCustomerRequest = ( clients ) => new Promise( ( resolve, reject ) => {
		forEach( clients, ( client ) => {
			// when one of the clients is assigned to a chat
			client.once( 'chat.open', ( chat ) => resolve( client ) )
		} )
		service.startCustomer()
		.then( ( client ) => {
			client.emit( 'message', { id: 'message-id', text: 'help' } )
		}, reject )
	} )

	const waitForChatOperatorList = ( client ) => new Promise( ( resolve, reject ) => {
		client.once( 'chat.online', ( chat, operators ) => resolve( operators ) )
	} )

	before( () => service.start() )
	after( () => service.stop() )

	it( 'get operator list for chat', () => {
		return connectAllOperators()
		.then( ( clients ) => { 
			return openCustomerRequest( clients )
			.then( waitForChatOperatorList )
		} )
		.then( ( operators ) => {
			equal( operators.length, 1 )
		} )
	} )
} )
