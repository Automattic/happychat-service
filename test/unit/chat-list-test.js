import { ok, equal } from 'assert'
import { EventEmitter } from 'events'
import { isFunction, isArray } from 'lodash/lang'

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
		chatlist = new ChatList( { operators, customers, timeout: 200 } )
	} )

	it( 'should notify when new chat has started', ( done ) => {
		chatlist.once( 'open', ( { id } ) => {
			equal( id, 'chat-id' )
			done()
		} )
		emitCustomerMessage()
	} )

	it( 'should emit open request to operators', ( done ) => {
		operators.on( 'assign', tick( ( { id }, callback ) => {
			// chat is now pending an operator
			ok( chatlist._pending['chat-id'] )
			equal( id, 'chat-id' )
			ok( isFunction( callback ) )
			done()
		} ) )
		emitCustomerMessage()
	} )

	it( 'should move chat to active when operator found', ( done ) => {
		operators.on( 'assign', tick( ( _, callback ) => {
			callback( null, { id: 'operator-id', socket: new EventEmitter() } )
		} ) )
		chatlist.on( 'found', tick( ( { id }, operator ) => {
			equal( id, 'chat-id' )
			equal( operator.id, 'operator-id' )
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
		operators.once( 'assign', ( _, callback ) => callback( null, { id: operator_id, socket } ) )
		chatlist.once( 'found', () => resolve() )
		emitCustomerMessage()
	} )

	describe( 'with active chat', () => {
		const operator_id = 'operator_id'
		var socket = new EventEmitter()
		beforeEach( () => assignOperator( operator_id, socket ) )

		it( 'should mark chats as abandoned when their operator disconnects', () => {
			socket.emit( 'disconnect' )
			const abandoned = chatlist._abandoned['chat-id']
			ok( abandoned, 'chat not marked as abandoned' )
			equal( abandoned.operator, operator_id )
			ok( socket )
		} )
	} )

	describe( 'with abandoned chat', () => {
		it( 'should reassign operator and make chats active', ( done ) => {
			const operator_id = 'operator-id'
			const chat_id = 'chat-id'
			const socket = new EventEmitter()
			const abandoned = { operator: operator_id, channel: { id: chat_id } }
			chatlist._abandoned = { 'chat-id': abandoned }

			socket.on( 'chats', tick( ( chats, recovered ) => {
				recovered()
				ok( isArray( chats ) )
				ok( isFunction( recovered ) )
				equal( chats.length, 1 )
				ok( !chatlist._abandoned[chat_id], 'chat still marked as abandoned' )
				equal( chatlist._chats[chat_id], operator_id, 'chat not marked as an active chat' )
				done()
			} ) )
			operators.emit( 'init', { id: operator_id, socket } )
		} )
	} )
} )
