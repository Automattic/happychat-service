import { equal, deepEqual } from 'assert';
import { ChatLog } from 'state/middlewares/system/controller';
import { map, range } from 'ramda';

describe( 'ChatLog', () => {
	const maxMessages = 10;
	const chat = { id: 'chat-id' };
	let log;
	beforeEach( () => {
		log = new ChatLog( { maxMessages } );
	} );

	const mockUser = { id: 'user-id', displayName: 'Furiosa' };

	it( 'should append messages', () => {
		const message = { session_id: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 };
		const message2 = { session_id: 'user-id', id: 'message-id-2', text: 'goodbye', timestamp: 12346 };
		return log.append( chat.id, message )
			.then( () => log.append( chat.id, message2 ) )
			.then( () => log.findLog( chat.id ) )
			.then( messages => {
				const [ head ] = messages;
				equal( messages.length, 2 );
				equal( head.id, 'message-id' );
			} );
	} );

	it( 'should find log by chat id', () => {
		return log.findLog( 1 ).then( messages => {
			equal( messages.length, 0 );
		} );
	} );

	describe( 'with many messages', () => {
		beforeEach( () => Promise.all(
			map(
				i => log.append( chat.id, { id: `message-${ i }`, text: `message-${ i }` } ),
				range( 0, 20 )
			)
		) );

		it( 'should limit the size of the chat log cache', () => {
			return log.findLog( chat.id ).then( messages => {
				const [ first, ... remaining ] = messages;
				const [ last ] = remaining.reverse();
				equal( messages.length, maxMessages );
				equal( last.id, 'message-19' );
				equal( first.id, 'message-10' );
			} );
		} );

		it( 'should remove log', () => {
			return log.evict( chat.id )
				.then( () => log.findLog( chat.id ) )
				.then( messages => {
					deepEqual( messages, [] );
				} );
		} );
	} );
} );
