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

	it( 'should emit open request to operators', ( done ) => {
		operators.on( 'assign', tick( ( { id }, name, callback ) => {
			// chat is now pending an operator
			ok( chatlist._pending['chat-id'] )
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
			deepEqual( chatlist._operators[operator.id], [ id ] )
			ok( ! chatlist._pending[id] )
			ok( chatlist._chats[id] )
			done()
		} ) )
		emitCustomerMessage()
	} )

	it( 'should timeout if no operator provided', ( done ) => {
		chatlist.on( 'miss', tick( ( error, { id } ) => {
			equal( id, 'chat-id' )
			done()
		} ) )
		emitCustomerMessage()
	} )

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
			chatlist._pending = { abd: { id: 'abd', user: 'Pending' } }
			chatlist._chats = { 123: { id: '123', user: 'Active' } }
			chatlist._abandoned = { xyz: { channel: { id: 'xyz', user: 'Abandoned' } } }
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
			chatlist._chats[ 'the-id' ] = { id: 'the-id' }
			chatlist._operators = { 'op-id': [ 'the-id' ] }
			return assignOperator( operator_id, socket )
		} )

		it( 'should mark chats as abandoned when operator is completely disconnected', ( done ) => {
			operators.on( 'leave', tick( () => {
				ok( chatlist._abandoned['the-id'] )
				ok( !chatlist._chats['the-id'], 'chat not removed from active chat list' )
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
			chatlist._abandoned = { 'chat-id': abandoned }

			operators.on( 'recover', tick( ( operator, chats, complete ) => {
				complete()
				ok( operator )
				ok( operator.socket )
				ok( operator.user )
				ok( isArray( chats ) )
				ok( isFunction( complete ) )
				equal( chats.length, 1 )
				ok( !chatlist._abandoned[chat_id], 'chat still marked as abandoned' )
				ok( chatlist._chats[chat_id], 'chat not marked as an active chat' )
				done()
			} ) )
			operators.emit( 'init', { user: { id: operator_id }, socket } )
		} )
	} )
} )
