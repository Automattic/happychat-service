import { equal, deepEqual } from 'assert'
import { ChatLog } from 'state/middlewares/socket-io/controller'
import { forEach, range } from 'ramda'

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
		log.recordMessage( chat, message )
		log.recordMessage( chat, message2 )
		const messages = log.findLog( chat.id )
		const [ head ] = messages
		equal( messages.length, 2 )
		equal( head.id, 'message-id' )
	} )

	it( 'should append operator message', () => {
		const user = mockUser
		const message = { id: 'operator-message-id', user, timestamp: 12345 }
		log.recordMessage( chat, message )
		const [ head ] = log.findLog( chat.id )
		equal( head.id, 'operator-message-id' )
	} )

	it( 'should append agent message', () => {
		const message = { id: 'agent-message-id' }
		log.recordMessage( chat, message )
		let [ head ] = log.findLog( chat.id )
		equal( head.id, 'agent-message-id' )
	} )

	it( 'should find log by chat id', () => {
		equal( log.findLog( 1 ).length, 0 )
	} )

	describe( 'with many messages', () => {
		beforeEach( () => {
			forEach(
				i => log.recordMessage( chat, { id: `message-${i}`, text: `message-${i}` } ),
				range( 0, 20 )
			)
		} )

		it( 'should limit the size of the chat log cache', () => {
			const messages = log.findLog( chat.id )
			const [ first, ... remaining ] = messages
			const [ last ] = remaining.reverse()
			equal( messages.length, maxMessages )
			equal( last.id, 'message-19' )
			equal( first.id, 'message-10' )
		} )

		it( 'should remove log', () => {
			log.evict( chat.id )
			deepEqual( log.findLog( chat.id ), [] )
		} )
	} )
} )
