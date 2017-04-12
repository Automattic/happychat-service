import { equal, deepEqual } from 'assert'

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
	STATUS_AVAILABLE,
	STATUS_RESERVE
} from 'state/operator/constants'
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

	const blockedState = {
		locales: { defaultLocale: 'en', supported: [ 'en', 'cz' ], memberships: {
			en: { op1: { capacity: 3, load: 0, active: true } },
			cz: { op2: { capacity: 1, load: 1, active: true } }
		} },
		operators: { identities: {
			op1: { id: 'op1', status: STATUS_AVAILABLE, online: true },
			op2: { id: 'op2', status: STATUS_AVAILABLE, online: true }
		} },
		chatlist: {
			chat_cz: [STATUS_PENDING, { id: 'chat_cz'}, null, 1, {}, 'cz'],
			chat_en: [STATUS_PENDING, { id: 'chat_en'}, null, 2, {}, 'en'],
			chat_en2: [STATUS_PENDING, { id: 'chat_en2'}, null, 3, {}, 'en']
		},
		groups: {
			[ DEFAULT_GROUP_ID ]: { members: { op1: true, op2: true } },
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

	it( 'should assign chat if earlier chat is unassigned', () => dispatchAction(
		assignNextChat(),
		blockedState
	).then( action => {
		deepEqual( action, assignChat( { id: 'chat_en'} ) )
	} ) )

	const reserveState = ( { activeOpsHaveCapacity } ) => ( {
		locales: { defaultLocale: 'en', supported: [ 'en', 'fr' ], memberships: {
			en: {},
			fr: {
				active1: { capacity: ( activeOpsHaveCapacity ? 1 : 0 ), active: true },
				active2: { capacity: ( activeOpsHaveCapacity ? 2 : 0 ), active: true },
				reserve1: { capacity: 4, active: true },
				reserve2: { capacity: 5, active: true },
			}
		} },
		chatlist: {
			chat: [ STATUS_PENDING, { id: 'chat' }, null, 2, {}, 'fr' ],
		},
		operators: { identities: {
			active1: { id: 'active1', status: STATUS_AVAILABLE, online: true },
			active2: { id: 'active2', status: STATUS_AVAILABLE, online: true },
			reserve1: { id: 'reserve1', status: STATUS_RESERVE, online: true },
			reserve2: { id: 'reserve2', status: STATUS_RESERVE, online: true },
		} },
		groups: {
			[ DEFAULT_GROUP_ID ]: { members: { active1: true, active2: true, reserve1: true, reserve2: true } },
		}
	} );

	it( 'should assign active operator before reserve operator', () => dispatchAction(
		assignChat( { id: 'chat' } ),
		reserveState( { activeOpsHaveCapacity: true } )
	).then( action => {
		equal( action.type, SET_CHAT_OPERATOR )
		equal( action.operator.id, 'active2' )
	} ) );

	it( 'should assign reserve operator when active operators are busy', () => dispatchAction(
		assignChat( { id: 'chat' } ),
		reserveState( { activeOpsHaveCapacity: false } )
	).then( action => {
		equal( action.type, SET_CHAT_OPERATOR )
		equal( action.operator.id, 'reserve2' )
	} ) );
} )
