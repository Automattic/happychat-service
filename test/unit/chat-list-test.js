import { ok, equal, deepEqual } from 'assert'
import { EventEmitter } from 'events'
import { isFunction, isArray } from 'lodash/lang'
import { map } from 'lodash/collection'

import { ChatList } from 'chat-list'
import { tick } from '../tick'
import io from '../mock-io'

import { getChat, getChatStatus, getChatOperator } from 'state/chat-list'

const debug = require( 'debug' )( 'happychat:chat-list:test' )

const mockServer = () => {
	const server = new EventEmitter()
	server.io = io().server
	return server
}

const TIMEOUT = 10

describe( 'ChatList', () => {
	let chatlist
	let operators
	let customers
	const emitCustomerMessage = ( id = 'chat-id', text = 'hello' ) => {
		customers.emit( 'message', { id }, { text } )
	}

	const autoAssign = ops => {
		ops.on( 'assign', ( { id }, name, callback ) => {
			callback( null, { id: 'operator-id', socket: new EventEmitter() } )
		} )
	}

	const chatlistWithState = ( state ) => {
		operators = mockServer()
		customers = mockServer()
		return new ChatList( {
			operators,
			customers,
			timeout: TIMEOUT,
			customerDisconnectTimeout: TIMEOUT,
			state
		} )
	}

	beforeEach( () => {
		operators = mockServer()
		customers = mockServer()
		chatlist = new ChatList( {
			operators,
			customers,
			timeout: TIMEOUT,
			customerDisconnectTimeout: TIMEOUT
		} )
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
			// chat is now being assigned to an operator
			equal( id, 'chat-id' )
			const state = chatlist.store.getState()
			const chat = getChat( id, state )
			ok( chat )
			equal( getChatStatus( id, state ), 'assigning' )
			ok( isFunction( callback ) )
			done()
		} ) )
		emitCustomerMessage()
	} )

	it( 'should move chat to active when operator found', done => {
		operators.on( 'assign', tick( ( { id }, name, callback ) => {
			callback( null, { id: 'operator-id', socket: new EventEmitter() } )
		} ) )
		chatlist.on( 'found', tick( ( { id }, operator ) => {
			equal( id, 'chat-id' )
			equal( operator.id, 'operator-id' )
			equal( getChatStatus( id, chatlist.store.getState() ), 'assigned' )
			deepEqual( getChatOperator( id, chatlist.store.getState() ), operator )
			done()
		} ) )
		emitCustomerMessage()
	} )

	it( 'should send chat event message when operator is found', done => {
		autoAssign( operators )
		operators.on( 'message', tick( ( { id: chat_id }, operator, message ) => {
			equal( message.session_id, 'chat-id' )
			equal( message.meta.event_type, 'assigned' )
			deepEqual( message.meta.operator.id, 'operator-id' )
			done()
		} ) )
		emitCustomerMessage()
	} )

	it( 'should timeout if no operator provided', () => new Promise( resolve => {
		chatlist.on( 'miss', tick( ( error, { id } ) => {
			equal( error.message, 'timeout' )
			equal( id, 'chat-id' )
			resolve()
		} ) )
		emitCustomerMessage()
	} ) )

	it( 'should ask operators for status when customer joins', ( done ) => {
		chatlist = chatlistWithState( { 'session-id': [ 'assigned' ] } )
		const socket = new EventEmitter();

		operators.on( 'accept', tick( ( chat, callback ) => {
			equal( chat.id, 'session-id' )
			equal( typeof callback, 'function' )
			// report that there is capacity
			callback( null, true )
		} ) )

		customers.on( 'accept', tick( ( chat, status ) => {
			equal( chat.id, 'session-id' )
			ok( status )
			done()
		} ) )

		customers.emit( 'join', { session_id: 'session-id' }, { id: 'session-id' }, socket )
	} )

	it( 'should fail status check if callback throws an error', done => {
		operators.on( 'accept', () => {
			throw new Error( 'oops' )
		} )

		customers.on( 'accept', tick( ( chat, status ) => {
			equal( chat.id, 'session-id' )
			ok( ! status )
			done()
		} ) )

		customers.emit( 'join', { session_id: 'session-id' }, { id: 'session-id' } )
	} )

	it( 'should fail status check if callback times out', done => {
		customers.on( 'accept', tick( ( chat, status ) => {
			equal( chat.id, 'session-id' )
			ok( ! status )
			done()
		} ) )

		customers.emit( 'join', { session_id: 'session-id' }, { id: 'session-id' } )
	} )

	it( 'should fail status check if existing chat is not assigned', ( done ) => {
		chatlist._chats = { 'assigned-id': [ 'missed', { id: 'assigned-id' } ] }
		customers.on( 'accept', tick( ( chat, status ) => {
			equal( chat.id, 'assigned-id' )
			ok( ! status )
			done()
		} ) )
		customers.emit( 'join', { session_id: 'assigned-id' }, { id: 'assigned-id' } )
	} )

	const assignOperator = ( operator_id, socket = new EventEmitter() ) => new Promise( ( resolve ) => {
		operators.once( 'assign', ( chat, room, callback ) => callback( null, { id: operator_id, socket } ) )
		chatlist.once( 'found', () => resolve() )
		emitCustomerMessage()
	} )

	describe( 'with customer connections', () => {
		let socket
		var operator_id = 'op'
		beforeEach( () => {
			// mock up some connected customer accounts
			chatlist = chatlistWithState( {
				abd: [ 'pending', { id: 'abd', user: 'Pending' } ],
				123: [ 'assigned', { id: '123', user: 'Active' } ],
				xyz: [ 'abandoned', { id: 'xyz', user: 'Abandoned' } ]
			} )
			socket = new EventEmitter()
		} )

		it( 'should send operator list of active connections', ( done ) => {
			socket.once( 'chats', ( list ) => {
				debug( 'received', list )
				equal( list.length, 3 )
				deepEqual( map( list, ( { user } ) => user ), [ 'Active', 'Pending', 'Abandoned' ] )
				done()
			} )
			operators.emit( 'init', { user: { id: operator_id }, socket } )
		} )
	} )

	describe( 'with active chat', () => {
		const operator_id = 'operator_id'
		const chat = {id: 'the-id'}
		var socket = new EventEmitter()

		beforeEach( () => {
			chatlist = chatlistWithState( { 'the-id': [ 'assigned', chat, {id: operator_id} ] } )
			return assignOperator( operator_id, socket )
		} )

		it( 'should store assigned operator', () => {
			equal( getChatOperator( chat.id, chatlist.store.getState() ).id, operator_id )
		} )

		it( 'should mark chats as abandoned when operator is completely disconnected', ( done ) => {
			operators.on( 'disconnect', tick( () => {
				ok( getChat( chat.id, chatlist.store.getState() ) )
				equal( getChatStatus( chat.id, chatlist.store.getState() ), 'abandoned' )
				done()
			} ) )
			operators.emit( 'disconnect', { id: operator_id } )
		} )

		it( 'should allow operator to close chat', ( done ) => {
			operators.once( 'close', ( _chat, room, operator ) => {
				deepEqual( operator, { id: 'op-id' } )
				deepEqual( _chat, chat )
				equal( room, `customers/${chat.id}` )
				ok( ! getChat( chat.id, chatlist.store.getState() ) )
				done()
			} )
			operators.emit( 'chat.close', 'the-id', { id: 'op-id' } )
		} )

		it( 'should request chat transfer', ( done ) => {
			const newOperator = { id: 'new-operator' }
			operators.once( 'transfer', ( _chat, from, to, complete ) => {
				deepEqual( _chat, chat )
				equal( from.id, operator_id )
				deepEqual( to, newOperator )
				ok( isFunction( complete ) )
				done()
			} )
			operators.emit( 'chat.transfer', chat.id, { id: operator_id }, newOperator )
		} )

		it( 'should not fail to transfer chat with no assigned operator', done => {
			const newOperator = { id: 'new-operator' }
			chatlist = chatlistWithState( { 'the-id': [ 'assigned', chat, null ] } )
			chatlist.once( 'miss', () => {
				done( new Error( 'failed to transfer chat' ) )
			} )
			operators.once( 'transfer', ( _chat, fromOperator, toOperator, callback ) => {
				debug( 'calling back!', fromOperator )
				debug( 'callback!', toOperator )
				callback( null, toOperator.id )
			} )
			chatlist.once( 'transfer', ( _chat, op_id ) => {
				equal( op_id, 'new-operator' )
				done()
			} )
			operators.emit( 'chat.transfer', chat.id, { id: operator_id }, newOperator )
		} )

		it( 'should timeout when transfering chat to unavailable operator', ( done ) => {
			const newOperator = { id: 'new-operator' }
			chatlist.once( 'miss', tick( ( error, _chat ) => {
				equal( error.message, 'timeout' )
				deepEqual( _chat, chat )
				done()
			} ) )
			operators.emit( 'chat.transfer', chat.id, { id: operator_id }, newOperator )
		} )

		it( 'should transfer chat to new operator', ( done ) => {
			const newOperator = { id: 'new-operator' }
			operators.once( 'transfer', ( _chat, from, op, success ) => {
				equal( from.id, operator_id )
				success( null, newOperator.id )
			} )
			chatlist.once( 'transfer', ( _chat, op ) => {
				deepEqual( _chat, chat )
				deepEqual( op, newOperator.id )
				done()
			} )
			operators.emit( 'chat.transfer', chat.id, { id: operator_id }, newOperator )
		} )

		it( 'should log message when chat is transferred', done => {
			const newOperator = { id: 'new-operator' }
			chatlist.once( 'miss', () => {
				done( new Error( 'failed to transfer chat' ) )
			} )
			operators.once( 'transfer', ( cht, from, op, success ) => success( null, op ) )
			operators.once( 'message', tick( ( { id: chat_id }, operator, message ) => {
				equal( chat_id, chat.id )
				ok( message.id )
				ok( message.timestamp )
				equal( message.type, 'event' )
				equal( message.text, 'chat transferred' )
				deepEqual( message.meta.to, newOperator )
				deepEqual( message.meta.from, { id: operator_id } )
				equal( message.meta.event_type, 'transfer' )
				done()
			} ) )
			operators.emit( 'chat.transfer', chat.id, { id: operator_id }, newOperator )
		} )

		it( 'should send message when operator joins', done => {
			const newOperator = { id: 'joining-operator' }
			operators.once( 'message', tick( ( { id: chat_id }, operator, message ) => {
				equal( chat_id, chat.id )
				ok( message.id )
				deepEqual( message.meta.operator, newOperator )
				equal( message.meta.event_type, 'join' )
				done()
			} ) )
			operators.emit( 'chat.join', chat.id, newOperator )
		} )

		it( 'should send message when operator leaves', done => {
			const newOperator = { id: 'leaving-operator' }
			operators.once( 'message', tick( ( { id: chat_id }, operator, message ) => {
				equal( chat_id, chat.id )
				deepEqual( message.meta.operator, newOperator )
				equal( message.meta.event_type, 'leave' )
				ok( message )
				done()
			} ) )
			operators.emit( 'chat.leave', chat.id, newOperator )
		} )

		it( 'should send a message when operator closes chat', done => {
			operators.once( 'message', tick( ( _chat, { id }, message ) => {
				equal( id, operator_id )
				deepEqual( _chat, chat )
				equal( message.type, 'event' )
				equal( message.meta.by.id, operator_id )
				equal( message.meta.event_type, 'close' )
				done()
			} ) )
			operators.emit( 'chat.close', chat.id, { id: operator_id } )
		} )
	} )

	describe( 'with abandoned chat', () => {
		it( 'should reassign operator and make chats active', ( done ) => {
			const operator_id = 'operator-id'
			const chat_id = 'chat-id'
			const socket = new EventEmitter()

			chatlist = chatlistWithState( {
				'chat-id': [ 'abandoned', { id: chat_id }, { id: operator_id } ]
			} )

			operators.on( 'recover', tick( ( operator, chats, complete ) => {
				complete()
				ok( operator )
				ok( operator.socket )
				ok( operator.user )
				ok( isArray( chats ) )
				ok( isFunction( complete ) )
				equal( chats.length, 1 )
				done()
			} ) )
			operators.emit( 'init', { user: { id: operator_id }, socket } )
		} )
	} )

	describe( 'with customer disconnect', () => {
		const operator_id = 'operator-id'
		const chat_id = 'chat-id'
		const user = { id: 'user-id' }
		const chat = { id: chat_id }
		const operator = { id: operator_id }

		beforeEach( () => {
			chatlist = chatlistWithState( { [ chat_id ]: [ 'assigned', chat, operator ] } )
		} )

		it( 'should send a message when customer disconnects', ( done ) => {
			operators.once( 'message', tick( ( _chat, _operator, message ) => {
				equal(
					getChatStatus( _chat.id, chatlist.store.getState() ),
					'customer-disconnect'
				)
				equal( _operator.id, operator_id )
				deepEqual( _chat, chat )
				equal( message.type, 'event' )
				equal( message.meta.event_type, 'customer-leave' )
				done()
			} ) )

			customers.emit( 'disconnect', chat, user )
		} )

		it( 'should revert back to assigned when customer disconnects and returns', ( done ) => {
			chatlist.once( 'chat.status', tick( ( status, _chat ) => {
				equal( status, 'customer-disconnect' )
				deepEqual( chat, _chat )

				chatlist.once( 'chat.status', tick( ( __status, __chat ) => {
					equal( __status, 'assigned' )
					deepEqual( chat, __chat )
				} ) )

				operators.once( 'message', tick( () => {
					throw new Error( 'operator should not be sent a message' )
				} ) )

				const socket = new EventEmitter()
				customers.emit( 'join', { id: user.id, socket_id: 'socket-id', session_id: 'session-id' }, chat, socket )

				// call done() after timeout to verify that operator message isn't sent
				setTimeout( () => done(), TIMEOUT + 1 )
			} ) )

			customers.emit( 'disconnect', chat, user )
		} )
	} )
} )
