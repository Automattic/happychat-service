import { deepEqual, ok } from 'assert'
import util, { authenticators } from './util'
import find from 'lodash/find'

const debug = require( 'debug' )( 'happychat:test:suggestion-test' )

describe( 'Chat logs', () => {
	let service
	let botUser = {
		id: 'imperator',
		dispayName: 'Furiosa',
		username: 'furiosa',
		avatarURL: 'http://example.com/furiousa'
	}

	const afterInit = ( { customer, operator, agent } ) => new Promise( ( resolve ) => {
		operator.on( 'available', ( _, available ) => process.nextTick( () => available( { capacity: 1, load: 0 } ) ) )
		operator.on( 'identify', callback => callback( { id: 'operator' } ) )
		customer.on( 'init', () => resolve( { customer, operator, agent } ) )
	} )

	const meta = {
		suggestions: [ 1, 2, 3 ]
	}

	const replyToCustomerMessage = ( clients ) => new Promise( ( resolve ) => {
		clients.agent.on( 'message', ( message ) => {
			const { session_id, text, author_type } = message
			if ( author_type === 'agent' ) {
				return
			}
			clients.agent.emit( 'message', {
				id: 'message-2',
				session_id,
				text: `re: ${text}`,
				user: botUser,
				type: 'elfbot',
				meta: meta
			} )
		} )
		resolve( clients )
	} )

	const setOperatorOnline = ( clients ) => new Promise( ( resolve ) => {
		clients.operator.emit( 'status', 'online', () => resolve( clients ) )
	} )

	const sendCustomerMessage = ( msg ) => ( clients ) => new Promise( resolve => {
		process.nextTick( () => {
			clients.customer.emit( 'message', { id: ( new Date() ).getTime(), text: msg } )
		} )
		resolve( clients )
	} )

	const listenForLog = clients => new Promise( resolve => {
		// It could be in the log or received as the next message depending on
		// how quickly the client connects
		clients.operator.on( 'log', ( _, log ) => resolve( log ) )
		clients.operator.on( 'chat.message', ( chat, message ) => resolve( [ message ] ) )
	} )

	beforeEach( () => {
		service = util( authenticators( { id: 'customer' }, { id: 'operator' }, {} ) )
		return service.start()
	} )

	afterEach( () => service.stop() )

	it( 'should support meta and message type from agent', () => (
		service.startClients()
			.then( afterInit )
			.then( replyToCustomerMessage )
			.then( setOperatorOnline )
			.then( sendCustomerMessage( 'hola mundo' ) )
			.then( listenForLog )
			.then( log => {
				const suggestion = find( log, ( { type } ) => type === 'elfbot' )

				ok( suggestion )
				deepEqual( suggestion.meta, meta )
			} )
	) )
} )
