import { ok, equal, deepEqual } from 'assert'
import operator from '../../src/operator'
import mockio from '../mock-io'
import { tick } from '../tick'
import { map } from 'lodash/collection'
import { isEmpty } from 'lodash/lang'

const debug = require( 'debug' )( 'tinkerchat:test:operators' )

describe( 'Operators', () => {
	let operators
	let socketid = 'socket-id'
	let user
	let socket, client, server

	const connectOperator = ( { socket: useSocket, client: useClient }, authUser = { id: 'user-id', displayName: 'name' } ) => new Promise( ( resolve ) => {
		debug( 'connect operator', authUser )
		operators.once( 'connection', ( _, callback ) => callback( null, authUser ) )
		useClient.once( 'init', ( clientUser ) => {
			useClient.emit( 'status', 'online', () => resolve( clientUser ) )
		} )
		server.connect( useSocket )
	} )

	beforeEach( () => {
		( { socket, client, server } = mockio( socketid ) )
		operators = operator( server )
	} )

	describe( 'when authenticated and online', () => {
		var op = { id: 'user-id', displayName: 'furiosa', avatarURL: 'url', priv: 'var' }
		beforeEach( ( done ) => {
			connectOperator( { socket, client }, op )
			.then( ( operatorUser ) => {
				user = operatorUser
				done()
			} )
		} )

		it( 'should recover chats for an operator', ( done ) => {
			operators.emit( 'recover', { user: op }, [ { id: 'something' } ], tick( () => {
				equal( operators.io.rooms['customers/something'].length, 1 )
				done()
			} ) )
		} )

		it( 'should emit message', ( done ) => {
			operators.on( 'message', ( { id: chat_id }, { id, displayName, avatarURL, priv }, { text, user: author } ) => {
				ok( id )
				ok( displayName )
				ok( avatarURL )
				ok( priv )
				ok( ! author.priv )
				equal( chat_id, 'chat-id' )
				equal( text, 'message' )
				done()
			} )
			client.emit( 'message', 'chat-id', { id: 'message-id', text: 'message' } )
		} )

		it( 'should assign an operator to a new chat', ( done ) => {
			// set up a second client
			const connection = server.newClient()
			const { client: clientb } = connection
			connectOperator( connection, user )
			.then( ( userb ) => {
				let a_open = false, b_open = false;
				client.on( 'chat.open', () => {
					a_open = true
				} )
				clientb.on( 'chat.open', () => {
					b_open = true
				} )

				client.on( 'available', ( chat, callback ) => {
					equal( chat.id, 'chat-id' )
					callback( { load: 5, capacity: 6, id: user.id } )
				} )
				clientb.on( 'available', ( chat, callback ) => {
					callback( { load: 5, capacity: 5, id: userb.id } )
				} )
				operators.emit( 'assign', { id: 'chat-id' }, 'room-name', ( error, assigned ) => {
					ok( ! error )
					ok( a_open )
					ok( b_open )
					ok( assigned.socket )
					equal( assigned.id, 'user-id' )
					done()
				} )
			} )
		} )

		it( 'should notify with updated operator list when operator joins', ( done ) => {
			const userb = { id: 'a-user', displayName: 'Jem' }
			const userc = { id: 'abcdefg', displayName: 'other' }
			server.on( 'operators.online', tick( ( identities ) => {
				equal( identities.length, 3 )
				deepEqual( map( identities, ( { displayName } ) => displayName ), [ 'furiosa', 'Jem', 'other' ] )
				done()
			} ) )

			const connectiona = server.newClient()
			const connectionb = server.newClient()
			const connectionc = server.newClient()

			client.on( 'identify', ( callback ) => callback( user ) )
			connectiona.client.on( 'identify', ( callback ) => callback( userb ) )
			connectionb.client.on( 'identify', ( callback ) => callback( user ) )
			connectionc.client.on( 'identify', ( callback ) => callback( userc ) )
			connectOperator( connectiona, userb )
			.then( () => connectOperator( connectionb, user ) )
			.then( () => connectOperator( connectionc, userc ) )
		} )
	} )

	it( 'should send init message to events', ( done ) => {
		operators.on( 'init', ( { user: u, socket: s, room } ) => {
			ok( u )
			ok( s )
			ok( room )
			equal( room, `operators/${u.id}` )
			done()
		} )
		connectOperator( server.newClient(), { id: 'a-user' } ).catch( done )
	} )
} )
