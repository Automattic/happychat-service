import { equal } from 'assert'
import { ChatLog } from '../../src/chat-log'

describe( 'ChatLog', () => {
	var log
	beforeEach( () => {
		log = new ChatLog()
	} )

	const mockUser = { id: 'user-id', displayName: 'Furiosa' }

	it( 'should append customer message', () => {
		const chat = { id: 'user-id' }
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
		const chat = { id: 'chat-id' }
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
		const chat = { id: 'chat-id' }
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
} )
