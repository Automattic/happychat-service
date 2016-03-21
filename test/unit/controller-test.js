import { equal } from 'assert'
import { EventEmitter } from 'events'
import { default as makeController } from '../../lib/controller'

describe( 'Controller', () => {
	var customers, agents

	beforeEach( () => {
		customers = new EventEmitter()
		agents = new EventEmitter()
		makeController( { customers, agents } )
	} )

	it( 'sends customer message to agents', ( done ) => {
		agents.on( 'receive', ( { id, timestamp, context, text, author_id, author_type } ) => {
			equal( id, 'message-id' )
			equal( timestamp, 12345 )
			equal( author_type, 'customer' )
			equal( context, 'user-id' )
			equal( author_id, 'user-id' )
			equal( text, 'hello' )
			done()
		} )
		customers.emit( 'message', { id: 'user-id' }, { id: 'message-id', text: 'hello', timestamp: 12345 } )
	} )

	it( 'sends agent messages to customers', ( done ) => {
		customers.on( 'receive', ( { author_type, id, context, timestamp, author_id } ) => {
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
} )
