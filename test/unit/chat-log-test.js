import { equal, ok } from 'assert'
import { ChatLog } from '../../src/chat-log'
import { reduce } from 'lodash/collection'

const debug = require( 'debug' )( 'tinkerchat:test:chat-log' )

describe( 'ChatLog', () => {
	const maxMessages = 10
	const chat = { id: 'chat-id' }
	var log
	beforeEach( () => {
		log = new ChatLog( { maxMessages } )
	} )

	const mockUser = { id: 'user-id', displayName: 'Furiosa' }

	it( 'should append customer message', () => {
		const message = { context: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 }
		const message2 = { context: 'user-id', id: 'message-id-2', text: 'goodbye', timestamp: 12346 }
		return log.recordCustomerMessage( chat, message )
		.then( () => log.recordCustomerMessage( chat, message2 ) )
		.then( () => log.findLog( chat.id ) )
		.then( ( messages ) => {
			const [ head ] = messages
			equal( messages.length, 2 )
			equal( head.id, 'message-id' )
		} )
	} )

	it( 'should append operator message', () => {
		const user = mockUser
		const message = { id: 'operator-message-id', user, timestamp: 12345 }
		return log.recordOperatorMessage( chat, user, message )
		.then( () => log.findLog( chat.id ) )
		.then( ( messages ) => {
			let [ head ] = messages
			equal( head.id, 'operator-message-id' )
		} )
	} )

	it( 'should append agent message', () => {
		const message = { id: 'agent-message-id' }
		return log.recordAgentMessage( chat, message )
		.then( () => log.findLog( chat.id ) )
		.then( ( messages ) => {
			let [ head ] = messages
			equal( head.id, 'agent-message-id' )
		} )
	} )

	it( 'should find log by chat id', () => {
		return log.findLog( 1 ).then( ( messages ) => equal( messages.length, 0 ) )
	} )

	it( 'should limit the size of the chat log cache', () => {
		var head, rest
		var record = ( i ) => () => {
			debug( 'recording', i )
			return log.recordCustomerMessage( chat, { id:`message-${i}`, text: `message-${i}` } )
		}
		var actions = []
		while( actions.length < 20 ) {
			actions.push( record( actions.length ) )
		}
		[ head, ...rest ] = actions
		return reduce( rest, ( p, action ) => p.then( action ), head() )
		.then( () => log.findLog( chat.id ) )
		.then( ( messages ) => {
			const [first, ... rest ] = messages
			const [last] = rest.reverse()
			equal( messages.length, maxMessages )
			equal( last.id, 'message-19' )
			equal( first.id, 'message-10' )
		} )
	} )
} )
