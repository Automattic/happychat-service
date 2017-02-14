import { createServer } from 'http'
import { service } from 'service'
import { assign } from 'lodash/object'
import {
	setOperatorStatus,
	setOperatorCapacity,
	setAcceptsCustomers
} from 'state/operator/actions'
import {
	STATUS_AVAILABLE
} from 'state/operator/selectors'
import { addGroup } from 'state/groups/actions'

import IOServer from 'socket.io'
import IO from 'socket.io-client'

const debug = require( 'debug' )( 'happychat:mock:service' )

export const startServer = ( server, port ) => new Promise( ( resolve ) => {
	server.listen( port, () => resolve() )
} )

export const stopServer = ( server ) => new Promise( ( resolve ) => {
	// TODO: server.close callback is not working
	server.close()
	resolve()
} )

const startClient = ( port, namespace = '/' ) => new Promise( ( resolve, reject ) => {
	const client = new IO( `http://localhost:${port}${namespace}` )
	client.once( 'connect', () => debug( 'client is connecting ', namespace ) )
	client.once( 'unauthorized', reject )
	resolve( client )
} )

export const startCustomer = ( port ) => startClient( port, '/customer' )
export const startAgent = ( port ) => startClient( port, '/agent' )
export const startOperator = ( port ) => startClient( port, '/operator' )

export const startClients = ( port ) => new Promise( ( resolve, reject ) => {
	const clients = {}
	startCustomer( port )
	.then( ( customer ) => {
		assign( clients, { customer } )
		return startAgent( port )
	} )
	.then( ( agent ) => {
		assign( clients, { agent } )
		return startOperator( port )
	} )
	.then( ( operator ) => {
		resolve( assign( clients, { operator } ) )
	} )
	.catch( reject )
} )

const main = ( authenticators, enhancers = [], port = 65115 ) => {
	const server = createServer()
	const io = new IOServer( server )
	const result = {
		service: service( io, authenticators, undefined, enhancers ),
		start: () => startServer( server, port ),
		stop: () => stopServer( server ),
		startClients: () => startClients( port ),
		startCustomer: () => startCustomer( port ),
		startAgent: () => startAgent( port ),
		startOperator: () => startOperator( port )
	}
	result.service.store.dispatch( addGroup( 'other', 'Other' ) )
	result.service.configureLocales( 'en-US', [ 'es' ] )
	return { ... result, ... result.service.store }
}

export { main as default }

export const authenticators = ( customer, operator, agent ) => {
	let customerAuthenticator = ( socket, callback ) => {
		callback( null, customer )
	}
	let agentAuthenticator = ( socket, callback ) => callback( null, agent )
	let operatorAuthenticator = ( socket, callback ) => callback( null, operator )
	return { customerAuthenticator, agentAuthenticator, operatorAuthenticator }
}

export const setClientCapacity = ( client, capacity = 1, status = STATUS_AVAILABLE ) => new Promise( resolve => {
	client.emit( 'broadcast.dispatch', setOperatorStatus( status ), () => {
		client.emit( 'broadcast.dispatch', setOperatorCapacity( 'en-US', capacity ), () => resolve( client ) )
	} )
} )

export const setSystemAvailable = ( client ) => new Promise( resolve => {
	client.emit( 'broadcast.dispatch', setAcceptsCustomers( true ), () => resolve( client ) )
} )
