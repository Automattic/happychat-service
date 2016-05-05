import { equal, deepEqual } from 'assert'
import { series, parallel } from 'async'
import { map } from 'lodash/collection'
import util from './util'

const debug = require( 'debug' )( 'tinkerchat:test:integration' )

const noop = () => {}
describe( 'Operator list', () => {
	let operators = [
		{ id: 'operator-1' },
		{ id: 'operator-2' },
		{ id: 'operator-3' },
		{ id: 'operator-4' }
	]

	const service = util( {
		operatorAuthenticator: ( ( users ) => ( socket, callback ) => {
			const [user, ... rest] = users
			debug( 'authenticating user', user )
			callback( null, user )
			users = rest
		} )( operators ),
		customerAuthenticator: noop,
		agentAuthenticator: noop
	} )

	const waitForConnect = ( client ) => new Promise( ( resolve ) => {
		debug( 'client is connecting' )
		client.once( 'connect', () => {
			debug( 'client connected' )
			resolve( client )
		} )
	} )

	before( () => service.start() )
	after( () => service.stop() )

	const connectAllOperators = () => new Promise( ( resolve ) => {
		series( map( operators, ( operator ) => ( callback ) => {
			service.startOperator()
			.then( waitForConnect )
			.then( ( client ) => {
				client.on( 'identify', ( identify ) => identify( operator ) )
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

	it( 'get updated operator lists', () => {
		return connectAllOperators()
		.then( waitForList )
		.then( ( { clients, lists } ) => {
			equal( lists.length, 4 )
			deepEqual(
				map( lists[0], ( { id } ) => id ),
				map( operators, ( { id } ) => id )
			)
			return Promise.resolve( clients )
		} )
		.then( disconnectOperator )
		.then( waitForList )
		.then( ( { lists } ) => {
			equal( lists.length, 3 )
			deepEqual(
				map( lists[0], ( { id } ) => id ),
				map( operators.slice( 1 ), ( { id } ) => id )
			)
		} )
	} )
} )
