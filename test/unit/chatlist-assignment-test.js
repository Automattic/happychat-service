import { equal } from 'assert'

import chatlistMiddleware from 'state/middlewares/socket-io/chatlist'
import mockio from '../mock-io'

import {
	assignChat,
	assignNextChat
} from 'state/chatlist/actions'
import {
	ASSIGN_CHAT,
	SET_CHAT_OPERATOR,
	SET_CHAT_MISSED
} from 'state/action-types'
import {
	STATUS_PENDING
}	from 'state/chatlist/reducer'
import {
	STATUS_AVAILABLE
} from 'state/operator/selectors'
import {
	DEFAULT_GROUP_ID
} from 'state/groups/reducer'

const noop = () => {}

describe( 'Chatlist Assignment', () => {
	const mock = () => ( {
		io: mockio().server,
		timeout: 1,
		customerDisconnectTimeout: 1,
		customerDisconnectMessageTimeout: 1
	} )

	const dispatchAction = ( action, state = {}, next = noop ) => new Promise( resolve => {
		chatlistMiddleware( mock() )( {
			getState: () => state,
			dispatch: resolve
		} )( next )( action )
	} )

	it( 'should assign operator to chat with default locale', () => dispatchAction(
		assignChat( { id: 'id' } ),
		{
			operators: { identities: {
				op1: { id: 'op1', status: STATUS_AVAILABLE, online: true }
			} },
			chatlist: {
				id: [ STATUS_PENDING, { id: 'id' }, null, 1, {}, null ]
			},
			locales: { defaultLocale: 'en-US', memberships: {
				'en-US': { op1: { load: 0, capacity: 1, active: true } }
			} },
			groups: { [ DEFAULT_GROUP_ID ]: { members: {
				op1: true
			} } }
		}
	).then( action => {
		equal( action.type, SET_CHAT_OPERATOR )
		equal( action.chat_id, 'id' )
		equal( action.operator.id, 'op1' )
	} ) )

	const ptbrState = {
		locales: { defaultLocale: 'fr', supported: [ 'fr', 'pt-BR' ], memberships: {
			'pt-BR': { pt1: { load: 0, capacity: 1, active: true } },
			fr: {
				en1: { capacity: 3, active: true },
				op: { capacity: 1, active: true }
			}
		} },
		chatlist: {
			pt: [ STATUS_PENDING, { id: 'pt' }, null, 1, {}, 'pt-BR' ],
			chat: [ STATUS_PENDING, { id: 'chat' }, null, 2, {} ],
			group: [ STATUS_PENDING, { id: 'group'}, null, 3, {}, null, [ 'a-group' ] ],
			special: [ STATUS_PENDING, { id: 'special' }, null, 4, {}, null, [ 'exclusive' ] ]
		},
		operators: { identities: {
			en1: { id: 'en1', status: STATUS_AVAILABLE, online: true },
			pt1: { id: 'pt1', status: STATUS_AVAILABLE, online: true },
			op: { id: 'op', status: STATUS_AVAILABLE, online: true }
		} },
		groups: {
			[ DEFAULT_GROUP_ID ]: { members: { en1: true, pt1: true } },
			'a-group': { members: { op: true } },
			exclusive: { members: { op2: true }, exclusive: true }
		}
	}

	it( 'should assign next chat', () => dispatchAction(
		assignNextChat(),
		ptbrState
	).then( action => {
		equal( action.type, ASSIGN_CHAT )
	} ) )

	it( 'should assign operator in locale matching chat', () => dispatchAction(
		assignChat( { id: 'pt' } ),
		ptbrState
	).then( action => {
		equal( action.type, SET_CHAT_OPERATOR )
		equal( action.operator.id, 'pt1' )
	} ) )

	it( 'should assign chat to default group', () => dispatchAction(
		assignChat( { id: 'chat' } ),
		ptbrState
	).then( action => {
		equal( action.type, SET_CHAT_OPERATOR )
		equal( action.operator.id, 'en1' )
	} ) )

	it( 'should assign chat to specified group', () => dispatchAction(
		assignChat( { id: 'group' } ),
		ptbrState
	).then( action => {
		equal( action.type, SET_CHAT_OPERATOR )
		equal( action.operator.id, 'op' )
	} ) )

	it( 'should filter out other groups when there is an exclusive group', () => dispatchAction(
		assignChat( { id: 'special' } ),
		ptbrState
	).then( action => {
		equal( action.type, SET_CHAT_MISSED )
	} ) )
} )
