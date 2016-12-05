import { deepEqual } from 'assert'
import {
	getChatMembers,
	getOpenChatMembers
} from 'state/chatlist/selectors'
import {
	STATUS_CLOSED,
} from 'state/chatlist/reducer';

describe( 'Chat List selectors', () => {
	const state = { chatlist: {
		1: [
			'assigned',
			{id: '1'},
			{id: 5},
			0,
			{5: true}
		],
		2: [
			STATUS_CLOSED,
			{id: 2},
			{id: 5},
			0,
			{5: true}
		]
	} }

	it( 'should get members of open chats', () => {
		deepEqual( getOpenChatMembers( state ), [ {5: true} ] )
	} )

	it( 'should get all memebers of chats', () => {
		deepEqual( getChatMembers( state ), [ {5: true}, {5: true} ] )
	} )
} )
