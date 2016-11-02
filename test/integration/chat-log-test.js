import { deepEqual } from 'assert'
import util, { authenticators } from './util'
import map from 'lodash/map'
import reduce from 'lodash/reduce'
import assign from 'lodash/assign'

const debug = require( 'debug' )( 'happychat:test:chat-logs' )

describe( 'Chat logs', () => {
	var service

	const mockMessages = [ 'hello', 'i need some help', 'can you help me?' ]

	const afterInit = ( { customer, operator } ) => new Promise( ( resolve ) => {
		operator.once( 'available', ( _, available ) => available( { capacity: 0, load: 0 } ) )
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

	const listenForLog = ( customer ) => new Promise( ( resolve ) => {
		debug( 'waiting for logs' )
		customer.once( 'log', ( ... args ) => resolve( args ) )
	} )

	const sendMessages = ( messages ) => ( customer ) => {
		debug( 'sending messages', messages.length )
		const [first, ... rest ] = messages
		return reduce( rest, ( p, msg ) => p.then( sendMessage( msg ) ), sendMessage( first )( customer ) )
	}

	const setOperatorOnline = ( client ) => new Promise( ( resolve ) => {
		debug( 'setting operator to online status' )
		client.emit( 'status', 'online', () => resolve( client ) )
	} )

	const acceptAllAssignments = ( client ) => new Promise( ( resolve ) => {
		debug( 'set accepting all chats' )
		client.once( 'identify', ( callback ) => {
			callback( { id: 'operator' } )
		} )
		client.once( 'available', ( chat, available ) => {
			debug( 'reporting as available' )
			available( { capacity: 1, status: 'available', load: 0 } )
		} )
		resolve( client )
	} )

	const wait = ( ms ) => thing => new Promise( resolve => {
		setTimeout( () => resolve( thing ), ms )
	} )

	beforeEach( () => {
		service = util( authenticators( { id: 'customer-a', session_id: '12345' }, { id: 'operator-1' }, {} ) )
		service.service.controller.middleware( ( { destination, message } ) => {
			if ( destination === 'customer' ) {
				return assign( {}, message, { text: 'test: ' + message.text } )
			}
			return message
		} )
		return service.start()
	} )
	afterEach( () => service.stop() )

	it( 'should deliver logs when customer joins chat', () => {
		return service.startClients()
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
	} )

	it.skip( 'should deliver logs to operator when joining chat', () => {
		return service.startClients()
		.then( afterInit )
		.then( sendMessages( mockMessages ) )
		.then( () => service.startOperator() )
		.then( acceptAllAssignments )
		.then( listenForLog )
		.then( ( [ , messages ] ) => {
			deepEqual( map( messages, ( { text } ) => text ), mockMessages )
		} )
	} )
} )
