import { equal, deepEqual } from 'assert'
import util, { authenticators } from './util'
import { map, reduce } from 'lodash/collection'

const debug = require( 'debug' )( 'tinkerchat:test:chat-logs' )

describe( 'Chat logs', () => {
	var service

	const mockMessages = [ 'hello', 'i need some help', 'can you help me?' ]

	const afterInit = ( { customer, operator } ) => new Promise( ( resolve ) => {
		operator.on( 'available', ( _, available ) => available( { capacity: 0, load: 0 } ) )
		customer.on( 'init', () => resolve( customer ) )
	} )

	const sendMessage = ( msg ) => ( customer ) => new Promise( ( resolve ) => {
		customer.emit( 'message', { id: ( new Date() ).getTime(), text: msg } )
		resolve( customer )
	} )

	const disconnect = ( customer ) => new Promise( ( resolve ) => {
		customer.on( 'disconnect', () => resolve( customer ) )
		customer.close()
	} )

	const connect = ( customer ) => new Promise( ( resolve ) => {
		customer.connect()
		resolve( customer )
	} )

	const listenForLog = ( customer ) => new Promise( ( resolve ) => {
		debug( 'waiting for logs' )
		customer.on( 'log', ( ... args ) => resolve( args ) )
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
		client.on( 'identify', ( callback ) => {
			callback( { id: 'operator' } )
		} )
		client.on( 'available', ( chat, available ) => {
			debug( 'reporting as available' )
			available( { capacity: 1, load: 0 } )
		} )
		resolve( client )
	} )

	beforeEach( () => {
		service = util( authenticators( { id: 'customer' }, { id: 'operator' }, {} ) )
		return service.start()
	} )
	afterEach( () => service.stop() )

	it( 'should deliver logs when customer joins chat', () => {
		return service.startClients()
		.then( afterInit )
		.then( sendMessages( mockMessages ) )
		.then( disconnect )
		.then( connect )
		.then( listenForLog )
		.then( ( [ log ] ) => {
			equal( log.length, 3 )
			deepEqual( map( log, ( { text } ) => text ), mockMessages )
		} )
	} )

	it( 'should deliver logs to operator when joining chat', () => {
		return service.startClients()
		.then( afterInit )
		.then( sendMessages( mockMessages ) )
		.then( () => service.startOperator() )
		.then( acceptAllAssignments )
		.then( setOperatorOnline )
		.then( listenForLog )
		.then( ( [ , messages ] ) => {
			equal( messages.length, 3 )
			deepEqual( map( messages, ( { text } ) => text ), mockMessages )
		} )
	} )
} )
