import { createServer } from 'http'
import service from '../../src/service'
import { assign } from 'lodash/object'

import IO from 'socket.io-client'

const debug = require( 'debug' )( 'tinkerchat:mock:service' )

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

const main = ( authenticators, port = 65115 ) => {
	let server = createServer()
	service( server, authenticators )
	return {
		start: () => startServer( server, port ),
		stop: () => stopServer( server ),
		startClients: () => startClients( port ),
		startCustomer: () => startCustomer( port ),
		startAgent: () => startAgent( port ),
		startOperator: () => startOperator( port )
	}
}

export { main as default }

export const authenticators = ( customer, operator, agent ) => {
	let customerAuthenticator = ( socket, callback ) => callback( null, customer )
	let agentAuthenticator = ( socket, callback ) => callback( null, agent )
	let operatorAuthenticator = ( socket, callback ) => callback( null, operator )
	return { customerAuthenticator, agentAuthenticator, operatorAuthenticator }
}
