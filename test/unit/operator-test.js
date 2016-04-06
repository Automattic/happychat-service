import { ok, equal } from 'assert'
import operator from '../../src/operator'
import mockio from '../mock-io'

const debug = require( 'debug' )( 'tinkerchat:test:operators' )

describe( 'Operators', () => {
	let operators
	let socketid = 'socket-id'
	let { socket, client, server } = mockio( socketid )
	let user
	beforeEach( () => {
		operators = operator( server )
	} )

	describe( 'when authenticated and online', () => {
		beforeEach( ( done ) => {
			operators.on( 'connection', ( _, callback ) => {
				callback( null, { id: 'user-id' } )
			} )
			client.once( 'init', ( clientUser ) => {
				user = clientUser
				client.emit( 'status', 'online', () => {
					done()
				} )
			} )
			server.connect( socket )
		} )

		it( 'should assign an operator to a new chat', ( done ) => {
			// set up a second client
			const { client: clientb } = server.connectNewClient( 'client-b', () => {
				let a_open = false, b_open = false;
				client.on( 'chat.open', () => {
					a_open = true
				} )
				clientb.on( 'chat.open', () => {
					b_open = true
				} )

				clientb.once( 'init', ( userb ) => {
					clientb.emit( 'status', 'online', () => {
						client.on( 'available', ( chat, callback ) => {
							equal( chat.id, 'chat-id' )
							callback( { load: 5, capacity: 6, id: user.id } )
						} )
						clientb.on( 'available', ( chat, callback ) => {
							callback( { load: 5, capacity: 5, id: userb.id } )
						} )
						operators.emit( 'assign', { id: 'chat-id' }, ( error, op ) => {
							ok( ! error )
							ok( a_open )
							ok( b_open )
							ok( op.socket )
							equal( op.id, 'user-id' )
							done()
						} )
					} )
				} )
			} )
		} )
	} )

	it( 'should fail', () => {
		ok( operators )
	} )
} )
