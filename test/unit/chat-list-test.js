import { ok, equal, deepEqual } from 'assert'
import { EventEmitter } from 'events'
import { isFunction, isArray } from 'lodash/lang'
import { map } from 'lodash/collection'

import { ChatList } from '../../src/chat-list'
import { tick } from '../tick'
import io from '../mock-io'

// for breaking out of the promise chain so errors are thrown to mocha
const mockServer = () => {
	const server = new EventEmitter()
	server.io = io().server
	return server
}

describe( 'ChatList', () => {
	let chatlist
	let operators
	let customers
	const emitCustomerMessage = ( id = 'chat-id', text = 'hello' ) => {
		customers.emit( 'message', { id }, { text } )
	}

	beforeEach( () => {
		operators = mockServer()
		customers = mockServer()
		chatlist = new ChatList( { operators, customers, timeout: 30 } )
	} )

	it( 'should notify when new chat has started', ( done ) => {
		chatlist.once( 'chat.status', tick( ( status, { id } ) => {
			equal( status, 'pending' )
			equal( id, 'chat-id' )
			done()
		} ) )
		emitCustomerMessage()
	} )

	it( 'should request operator for chat', ( done ) => {
		operators.on( 'assign', tick( ( { id }, name, callback ) => {
			// chat is now pending an operator
			ok( chatlist._chats['chat-id'] )
			equal( chatlist._chats['chat-id'][0], 'pending' )
			equal( id, 'chat-id' )
			ok( isFunction( callback ) )
			done()
		} ) )
		emitCustomerMessage()
	} )

	it( 'should move chat to active when operator found', ( done ) => {
		operators.on( 'assign', tick( ( { id }, name, callback ) => {
			callback( null, { id: 'operator-id', socket: new EventEmitter() } )
		} ) )
		chatlist.on( 'found', tick( ( { id }, operator ) => {
			equal( id, 'chat-id' )
			equal( operator.id, 'operator-id' )
			equal( chatlist._chats[id][0], 'assigned' )
			deepEqual( chatlist._chats[id][2], operator )
			done()
		} ) )
		emitCustomerMessage()
	} )

	it( 'should timeout if no operator provided', () => new Promise( ( resolve ) => {
		chatlist.on( 'miss', tick( ( error, { id } ) => {
			equal( id, 'chat-id' )
			resolve()
		} ) )
		emitCustomerMessage()
	} ) )

	const assignOperator = ( operator_id, socket = new EventEmitter() ) => new Promise( ( resolve ) => {
		operators.once( 'assign', ( chat, room, callback ) => callback( null, { id: operator_id, socket } ) )
		chatlist.once( 'found', () => resolve() )
		emitCustomerMessage()
	} )

	describe( 'with customer connections', () => {
		var socket
		var operator_id = 'op'
		beforeEach( () => {
			// mock up some connected customer accounts
			chatlist._chats = {
				'abd': [ 'pending', { id: 'abd', user: 'Pending' } ],
				'123': [ 'assigned', { id: '123', user: 'Active' } ],
				'xyz': [ 'abandoned', { id: 'xyz', user: 'Abandoned' } ]
			}
			socket = new EventEmitter()
		} )
		it( 'should send operator list of active connections', ( done ) => {
			socket.on( 'chats', tick( ( chats ) => {
				equal( chats.length, 3 )
				deepEqual( map( chats, ( { user } ) => user ), [ 'Active', 'Pending', 'Abandoned' ] )
				done()
			} ) )
			operators.emit( 'init', { user: { id: operator_id }, socket } )
		} )
	} )

	describe( 'with active chat', () => {
		const operator_id = 'operator_id'
		var socket = new EventEmitter()
		beforeEach( () => {
			chatlist._chats[ 'the-id' ] = [ 'assigned', {id: 'the-id'}, {id: 'op-id'} ]
			return assignOperator( operator_id, socket )
		} )

		it( 'should mark chats as abandoned when operator is completely disconnected', ( done ) => {
			operators.on( 'leave', tick( () => {
				ok( chatlist._chats['the-id'] )
				equal( chatlist._chats['the-id'][0], 'abandoned' )
				done()
			} ) )
			operators.emit( 'leave', { id: 'op-id' } )
		} )

		it( 'should allow operator to close chat', ( done ) => {
			operators.once( 'close', ( chat, room, operator ) => {
				deepEqual( operator, { id: 'op-id' } )
				deepEqual( chat, { id: 'the-id' } )
				equal( room, 'customers/the-id' )
				ok( !chatlist._chats['the-id'] )
				done()
			} )
			operators.emit( 'chat.close', 'the-id', { id: 'op-id' } )
		} )
	} )

	describe( 'with abandoned chat', () => {
		it( 'should reassign operator and make chats active', ( done ) => {
			const operator_id = 'operator-id'
			const chat_id = 'chat-id'
			const socket = new EventEmitter()
			const abandoned = { operator: { id: 'operator-id' }, channel: { id: chat_id } }
			chatlist._chats = { 'chat-id': [ 'abandoned', { id: chat_id }, { id: operator_id } ] }

			operators.on( 'recover', tick( ( operator, chats, complete ) => {
				complete()
				ok( operator )
				ok( operator.socket )
				ok( operator.user )
				ok( isArray( chats ) )
				ok( isFunction( complete ) )
				equal( chats.length, 1 )
				equal( chatlist._chats[chat_id][0], 'assigned' )
				done()
			} ) )
			operators.emit( 'init', { user: { id: operator_id }, socket } )
		} )
	} )
} )
