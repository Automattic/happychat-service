import { equal } from 'assert'
import { EventEmitter } from 'events'
import { default as makeController } from '../../src/controller'

describe( 'Controller', () => {
	var customers, agents, operators

	beforeEach( () => {
		customers = new EventEmitter()
		agents = new EventEmitter()
		operators = new EventEmitter()
		makeController( { customers, agents, operators } )
	} )

	const mockUser = { id: 'user-id', displayName: 'Furiosa' }
	const socketIdentifier = { id: mockUser.id, socketId: mockUser.id }

	describe( 'with user', () => {
		it( 'notifies agent when user joins', ( done ) => {
			agents.on( 'customer.join', ( { id, socketId }, { id: user_id, displayName } ) => {
				equal( id, 'user-id' )
				equal( socketId, 'user-id' )
				equal( user_id, 'user-id' )
				equal( displayName, 'Furiosa' )
				done()
			} )
			customers.emit( 'join', socketIdentifier, mockUser )
		} )

		it( 'notifies agent when user disconnects', ( done ) => {
			agents.on( 'customer.leave', ( { id, socketId }, { id: user_id, displayName } ) => {
				equal( id, 'user-id' )
				equal( socketId, 'user-id' )
				equal( user_id, 'user-id' )
				equal( displayName, 'Furiosa' )
				done()
			} )
			customers.emit( 'leave', socketIdentifier, mockUser )
		} )
	} )

	describe( 'customer message', () => {
		it( 'should notify customers', ( done ) => {
			customers.on( 'receive', ( chat, { id, context, text } ) => {
				equal( id, 'message-id' )
				equal( text, 'hello' )
				equal( context, 'user-id' )
				done()
			} )
			customers.emit( 'message', { id: 'user-id' }, { context: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 } )
		} )

		it( 'should notify agents', ( done ) => {
			agents.on( 'receive', ( { id, timestamp, context, text, author_id, author_type } ) => {
				equal( id, 'message-id' )
				equal( timestamp, 12345 )
				equal( author_type, 'customer' )
				equal( context, 'user-id' )
				equal( author_id, 'user-id' )
				equal( text, 'hello' )
				done()
			} )
			customers.emit( 'message', { id: 'user-id' }, { context: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 } )
		} )

		it( 'should notify operators', ( done ) => {
			operators.on( 'receive', ( user, message ) => {
				equal( message.id, 'message-id' )
				equal( message.context, 'user-id' )
				equal( message.text, 'hello' )
				done()
			} )
			customers.emit( 'message', { id: 'user-id' }, { context: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 } )
		} )
	} )

	describe( 'agent message', () => {
		it( 'should notify agents', ( done ) => {
			agents.on( 'receive', ( { author_type, id, context, timestamp, author_id } ) => {
				equal( author_type, 'agent' )
				equal( author_id, 'author' )
				equal( id, 'message-id' )
				equal( context, 'chat-id' )
				equal( timestamp, 12345 )
				done()
			} )
			agents.emit( 'message', { id: 'message-id', context: 'chat-id', timestamp: 12345, author_id: 'author' } )
		} )

		it( 'should notify customers', ( done ) => {
			customers.on( 'receive', ( chat, { author_type, id, context, timestamp, author_id } ) => {
				equal( author_type, 'agent' )
				equal( author_id, 'author' )
				equal( id, 'message-id' )
				equal( context, 'chat-id' )
				equal( timestamp, 12345 )
				done()
			} )
			//   - `id`: the id of the message
			// - `timestamp`: timestampe of the message
			// - `text`: content of the message
			// - `context`: the id of the channel the message was sent to
			// - `author_id`: the id of the author of the message
			// - `author_type`: One of `customer`, `support`, `agent`
			agents.emit( 'message', { id: 'message-id', context: 'chat-id', timestamp: 12345, author_id: 'author' } )
		} )

		it( 'should notify operators', ( done ) => {
			customers.on( 'receive', ( chat, { author_type, id, context, timestamp, author_id } ) => {
				equal( author_type, 'agent' )
				equal( author_id, 'author' )
				equal( id, 'message-id' )
				equal( context, 'chat-id' )
				equal( timestamp, 12345 )
				done()
			} )
			agents.emit( 'message', { id: 'message-id', context: 'chat-id', timestamp: 12345, author_id: 'author' } )
		} )
	} )

	describe( 'operator message', () => {
		it( 'should notify operators', ( done ) => {
			operators.on( 'receive', ( chat, message ) => {
				equal( chat.id, 'chat-id' )
				equal( message.id, 'message-id' )
				done()
			} )
			operators.emit( 'message', { id: 'chat-id' }, mockUser, { id: 'message-id', user: mockUser } )
		} )

		it( 'should notify agents', ( done ) => {
			agents.on( 'receive', ( { author_type, id, context, timestamp, author_id } ) => {
				equal( author_type, 'operator' )
				equal( author_id, 'user-id' )
				equal( id, 'message-id' )
				equal( context, 'chat-id' )
				equal( timestamp, 12345 )
				done()
			} )
			operators.emit( 'message', { id: 'chat-id' }, mockUser, { id: 'message-id', user: mockUser, timestamp: 12345 } )
		} )

		it( 'should notify customers', ( done ) => {
			customers.on( 'receive', ( chat, message ) => {
				equal( chat.id, 'chat-id' )
				equal( message.id, 'message-id' )
				done()
			} )
			operators.emit( 'message', { id: 'chat-id' }, mockUser, { id: 'message-id', user: mockUser, timestamp: 12345 } )
		} )
	} )
} )
