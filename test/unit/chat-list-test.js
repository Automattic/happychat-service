import { ok, equal } from 'assert'
import { EventEmitter } from 'events'
import { isFunction } from 'lodash/lang'

import { ChatList } from '../../src/chat-list'

// for breaking out of the promise chain so errors are thrown to mocha
const tick = ( fn ) => ( ... args ) => process.nextTick( () => fn( ... args ) )

describe( 'ChatList', () => {
	let chatlist
	let operators
	let customers
	let emitCustomerMessage = () => {
		customers.emit( 'message', { id: 'chat-id' }, { text: 'hello' } )
	}
	beforeEach( () => {
		operators = new EventEmitter()
		customers = new EventEmitter()
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
		operators.on( 'open', tick( ( { id }, callback ) => {
			// chat is now pending an operator
			ok( chatlist._pending['chat-id'] )
			equal( id, 'chat-id' )
			ok( isFunction( callback ) )
			done()
		} ) )
		emitCustomerMessage()
	} )

	it( 'should move chat to active when operator found', ( done ) => {
		operators.on( 'open', tick( ( _, callback ) => {
			callback( null, { id: 'operator-id' } )
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
} )
