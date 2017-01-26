import { equal } from 'assert'
import chatlistMiddleware from 'state/middlewares/socket-io/chatlist'
import mockio from '../mock-io'

import {
	assignChat,
	assignNextChat
} from 'state/chatlist/actions'
import {
	ASSIGN_CHAT,
	SET_CHAT_OPERATOR
} from 'state/action-types'
import {
	STATUS_PENDING
}	from 'state/chatlist/reducer'
import {
	STATUS_AVAILABLE
} from 'state/operator/selectors'

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
			} }
		}
	).then( action => {
		equal( action.type, SET_CHAT_OPERATOR )
		equal( action.chat_id, 'id' )
		equal( action.operator.id, 'op1' )
	} ) )

	const ptbrState = {
		locales: { defaultLocale: 'fr', supported: [ 'fr', 'pt-BR' ], memberships: {
			'pt-BR': { pt1: { load: 0, capacity: 1, active: true } }
		} },
		chatlist: {
			id: [ STATUS_PENDING, { id: 'id' }, null, 1, {}, 'pt-BR' ]
		},
		operators: { identities: {
			en1: { id: 'en1', status: STATUS_AVAILABLE, online: true },
			pt1: { id: 'pt1', status: STATUS_AVAILABLE, online: true }
		} }
	}

	it( 'should assign next chat', () => dispatchAction(
		assignNextChat(),
		ptbrState
	).then( action => {
		equal( action.type, ASSIGN_CHAT )
	} ) )

	it( 'should assign operator in locale matching chat', () => dispatchAction(
		assignChat( { id: 'id', locale: 'pt-BR' } ),
		ptbrState
	).then( action => {
		equal( action.type, SET_CHAT_OPERATOR )
		equal( action.operator.id, 'pt1' )
	} ) )

	it( 'should assign chat to default group' )
} )
