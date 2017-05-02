import { deepEqual } from 'assert'
import map from 'lodash/map'
import reduce from 'lodash/reduce'
import assign from 'lodash/assign'

import makeService, { authenticators, setClientCapacity, setSystemAvailable } from './helpers'

const debug = require( 'debug' )( 'happychat:test:chat-logs' )

describe( 'Chat logs', () => {
	let service

	const mockMessages = [ 'hello', 'i need some help', 'can you help me?' ]

	const afterInit = ( { customer } ) => new Promise( ( resolve ) => {
		customer.once( 'init', () => resolve( customer ) )
	} )

	const sendMessage = ( msg ) => ( customer ) => new Promise( ( resolve ) => {
		customer.emit( 'message', { id: ( new Date() ).getTime(), text: msg } )
		resolve( customer )
	} )

	const disconnect = ( customer ) => new Promise( ( resolve ) => {
		customer.once( 'disconnect', () => resolve( customer ) )
		customer.close()
	} )

	const connect = ( customer ) => new Promise( ( resolve ) => {
		customer.connect()
		resolve( customer )
	} )

	const listenForLog = ( client ) => new Promise( ( resolve ) => {
		if ( client._logs ) {
			debug( 'already received the logs' )
			return resolve( client._logs )
		}
		debug( 'waiting for logs' )
		client.once( 'log', ( ... args ) => resolve( args ) )
	} )

	const sendMessages = ( messages ) => ( customer ) => {
		debug( 'sending messages', messages.length )
		const [first, ... rest ] = messages
		return reduce( rest, ( p, msg ) => p.then( sendMessage( msg ) ), sendMessage( first )( customer ) )
	}

	const acceptAllAssignments = ( client ) => {
		client.once( 'log', ( ... args ) => client._logs = args )
		return setClientCapacity( client, 5 )
	}

	const wait = ( ms ) => thing => new Promise( resolve => {
		setTimeout( () => resolve( thing ), ms )
	} )

	beforeEach( () => {
		const filter = ( { destination, message } ) => {
			if ( destination === 'customer' ) {
				return assign( {}, message, { text: 'test: ' + message.text } )
			}
			return message
		}
		service = makeService( authenticators(
			// customer
			{ id: 'customer-a', session_id: '12345', picture: '', displayName: '', username: '' },
			// operator
			{ id: 'operator-1', picture: '', displayName: '', username: '' },
			// agent
			{ id: 'agent', picture: '', displayName: '', username: '' }
		), undefined, [ filter ] )
		return service.start()
	} )
	afterEach( () => service.stop() )

	it( 'should deliver logs when customer joins chat', () =>
		service.startClients()
		.then( afterInit )
		.then( sendMessages( mockMessages ) )
		.then( disconnect )
		.then( wait( 100 ) )
		.then( connect )
		.then( listenForLog )
		.then( ( [ log ] ) => {
			debug( 'log', log )
			deepEqual(
				map( log, ( { text } ) => text ),
				map( mockMessages, m => 'test: ' + m )
			)
		} )
	)

	it( 'should deliver logs to operator when joining chat', () => {
		return service.startClients()
		.then( afterInit )
		.then( sendMessages( mockMessages ) )
		.then( () => service.startOperator() )
		.then( setSystemAvailable )
		.then( acceptAllAssignments )
		.then( listenForLog )
		.then( ( [ , messages ] ) => {
			deepEqual( map( messages, ( { text } ) => text ), mockMessages )
		} )
	} )
} )
