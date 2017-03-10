import { deepEqual } from 'assert'
import { merge } from 'ramda'

import groups from 'state/groups/reducer'
import {
	getChatMemberIdentities,
	getOpenChatMembers,
	getChatGroups
} from 'state/chatlist/selectors'
import {
	STATUS_CLOSED,
} from 'state/chatlist/reducer';

describe( 'Chat List selectors', () => {
	const state = {
		locales: { defaultLocale: 'en' },
		groups: groups( undefined, {} ),
		operators: { identities: { 5: { id: '5', username: 'five' } } },
		chatlist: {
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
				{5: true},
				'en',
				[ 'super' ]
			]
		}
	}

	it( 'should get members of open chats', () => {
		deepEqual( getOpenChatMembers( state ).en, [ {5: true} ] )
	} )

	it( 'should get members of a chat', () => {
		deepEqual( getChatMemberIdentities( 1, state ), [ {id: '5', username: 'five' } ] )
	} )

	it( 'should get default group when chat is not assigned to one', () => {
		deepEqual(
			getChatGroups( 1, state ),
			[ { id: '__default', name: 'Default' } ]
		)
	} )

	it( 'should get groups chat is assigned to', () => {
		const group = { name: 'Super', id: 'super', exclusive: true }
		deepEqual(
			getChatGroups( 2, merge( state, { groups: {
				super: group
			} } ) ),
			[group]
		)
	} )
} )
