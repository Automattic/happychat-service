import { equal, deepEqual } from 'assert'
import { EventEmitter } from 'events'
import makeController from 'controller'
import createStore from 'store'
import mockio from '../mock-io'

describe( 'Controller', () => {
	let customers, agents, operators

	beforeEach( () => {
		customers = new EventEmitter()
		agents = new EventEmitter()
		operators = new EventEmitter()
		let chats = new EventEmitter()
		const store = createStore( { io: mockio().server, customers, operators, chatlist: chats } )
		makeController( { customers, agents, operators, store } )
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
			customers.emit( 'join', socketIdentifier, mockUser, new EventEmitter() )
		} )

		it( 'notifies agent when user disconnects', ( done ) => {
			agents.on( 'customer.disconnect', ( { id: chat_id }, { id: user_id, displayName } ) => {
				equal( chat_id, 'chat-id' )
				equal( user_id, 'user-id' )
				equal( displayName, 'Furiosa' )
				done()
			} )
			customers.emit( 'disconnect', { id: 'chat-id' }, mockUser )
		} )
	} )

	describe( 'customer message', () => {
		it( 'should notify customers', ( done ) => {
			customers.on( 'receive', ( chat, { id, session_id, text } ) => {
				equal( id, 'message-id' )
				equal( text, 'hello' )
				equal( session_id, 'user-id' )
				done()
			} )
			customers.emit( 'message', { id: 'user-id', session_id: 'user-id' }, { session_id: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 } )
		} )

		it( 'should notify agents', ( done ) => {
			agents.on( 'receive', ( { id, timestamp, session_id, text, author_id, author_type } ) => {
				equal( id, 'message-id' )
				equal( timestamp, 12345 )
				equal( author_type, 'customer' )
				equal( session_id, 'user-id' )
				equal( author_id, 'user-id' )
				equal( text, 'hello' )
				done()
			} )
			customers.emit( 'message', { id: 'user-id', session_id: 'user-id' }, { session_id: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 } )
		} )

		it( 'should notify operators', ( done ) => {
			operators.on( 'receive', ( user, message ) => {
				equal( message.id, 'message-id' )
				equal( message.session_id, 'user-id' )
				equal( message.text, 'hello' )
				done()
			} )
			customers.emit( 'message', { id: 'user-id', session_id: 'user-id' }, { session_id: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 } )
		} )
	} )

	describe( 'agent message', () => {
		it( 'should notify agents', ( done ) => {
			agents.on( 'receive', ( { author_type, id, session_id, timestamp, author_id } ) => {
				equal( author_type, 'agent' )
				equal( author_id, 'author' )
				equal( id, 'message-id' )
				equal( session_id, 'chat-id' )
				equal( timestamp, 12345 )
				done()
			} )
			agents.emit( 'message', { id: 'message-id', session_id: 'chat-id', timestamp: 12345, author_id: 'author' } )
		} )

		it( 'should notify customers', ( done ) => {
			customers.on( 'receive', ( chat, { author_type, id, session_id, timestamp, author_id } ) => {
				equal( author_type, 'agent' )
				equal( author_id, 'author' )
				equal( id, 'message-id' )
				equal( session_id, 'chat-id' )
				equal( timestamp, 12345 )
				done()
			} )
			//   - `id`: the id of the message
			// - `timestamp`: timestampe of the message
			// - `text`: content of the message
			// - `context`: the id of the channel the message was sent to
			// - `author_id`: the id of the author of the message
			// - `author_type`: One of `customer`, `support`, `agent`
			agents.emit( 'message', { id: 'message-id', session_id: 'chat-id', timestamp: 12345, author_id: 'author' } )
		} )

		it( 'should notify operators', ( done ) => {
			customers.on( 'receive', ( chat, { author_type, id, session_id, timestamp, author_id } ) => {
				equal( author_type, 'agent' )
				equal( author_id, 'author' )
				equal( id, 'message-id' )
				equal( session_id, 'chat-id' )
				equal( timestamp, 12345 )
				done()
			} )
			agents.emit( 'message', { id: 'message-id', session_id: 'chat-id', timestamp: 12345, author_id: 'author' } )
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
			agents.on( 'receive', ( { author_type, id, session_id, timestamp, author_id, type } ) => {
				equal( author_type, 'operator' )
				equal( author_id, 'user-id' )
				equal( id, 'message-id' )
				equal( session_id, 'chat-id' )
				equal( timestamp, 12345 )
				equal( type, 'type' )
				done()
			} )
			operators.emit( 'message', { id: 'chat-id' }, mockUser, { id: 'message-id', user: mockUser, timestamp: 12345, type: 'type' } )
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

	describe( 'customer `typing`', () => {
		it( 'should notify operators', ( done ) => {
			operators.on( 'receive.typing', ( chat, user, text ) => {
				equal( chat.id, 'chat-id' )
				equal( user.id, 'user-id' )
				equal( text, 'typing a message...' )
				done()
			} )

			customers.emit( 'typing', { id: 'chat-id' }, { id: 'user-id' }, 'typing a message...' )
		} )
	} )

	describe( 'operator `typing`', () => {
		it( 'should notify operators', ( done ) => {
			operators.on( 'receive.typing', ( chat, user, text ) => {
				equal( chat.id, 'chat-id' )
				equal( user.id, 'user-id' )
				equal( text, 'typing a message...' )
				done()
			} )

			operators.emit( 'typing', { id: 'chat-id' }, { id: 'user-id' }, 'typing a message...' )
		} )

		it( 'should notify customers', ( done ) => {
			customers.on( 'receive.typing', ( chat, user, text ) => {
				equal( chat.id, 'chat-id' )
				equal( user.id, 'user-id' )
				equal( text, 'typing a message...' )
				done()
			} )

			operators.emit( 'typing', { id: 'chat-id' }, { id: 'user-id' }, 'typing a message...' )
		} )
	} )

	describe( 'agents system.info', () => {
		it( 'should handle system.info event', done => {
			operators.once( 'identities', cb => cb( [ 'operator' ] ) )

			agents.emit( 'system.info', data => {
				deepEqual( data.chats, [] )
				deepEqual( data.operators, [ 'operator' ] )
				done()
			} )
		} )
	} )
} )
