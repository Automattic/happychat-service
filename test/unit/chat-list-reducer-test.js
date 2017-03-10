import { createStore, combineReducers } from 'redux'
import { deepEqual, equal } from 'assert'

import reducer, {
	STATUS_PENDING,
	STATUS_MISSED,
	STATUS_ABANDONED,
	STATUS_ASSIGNED,
	STATUS_CLOSED
} from 'state/chatlist/reducer'
import {
	// selectors
	getChatsForOperator,
	getMissedChats,
	getChatStatus,
	getAllChats,
	getOperatorAbandonedChats,
	getChatsWithStatus,
} from 'state/chatlist/selectors'
import {
	// actions
	insertPendingChat,
	closeChat,
	setChatsRecovered,
	setOperatorChatsAbandoned,
	operatorJoinChat,
	removeChat
} from 'state/chatlist/actions'
import {
	operatorChatLeave,
	operatorChatJoin,
} from 'state/operator/actions'
import {
	serializeAction
} from 'state'

const debug = require( 'debug' )( 'happychat:test' )

const defaultState = () => createStore( reducer ).getState()

const dispatchAction = ( action, subscriber, state = defaultState() ) => () => new Promise( resolve => {
	const { getState, subscribe, dispatch } = createStore( combineReducers( { chatlist: reducer } ), { chatlist: state } )
	subscribe( () => {
		subscriber( getState() )
		resolve()
	} )
	debug( 'dispatching', dispatch( action ) )
} )

describe( 'ChatList reducer', () => {
	it( 'should have default state', () => {
		deepEqual( defaultState(), {} )
	} )

	it( 'should select chats assigned to operator id', () => {
		deepEqual(
			getChatsForOperator( 'op-id', { chatlist: {
				chat1: [ 'status', 'chat1', { id: 'op-id' } ],
				chat2: ['status', 'chat2', { id: 'other-id' } ],
				chat3: ['status', 'chat3', { id: 'op-id' } ]
			} } ),
			[ 'chat1', 'chat3' ]
		)
	} )

	it( 'should select missed chats', () => {
		deepEqual(
			getMissedChats( { chatlist: {
				id: [ STATUS_MISSED, 'a' ],
				id2: [ STATUS_MISSED, 'b' ],
				id3: ['other', 'c']
			} } ),
			[ 'a', 'b' ]
		)
	} )

	it( 'should select all chats', () => {
		deepEqual(
			getAllChats( { chatlist: { 1: [null, 'a', null ], 2: [null, 'b', null ] } } ),
			[ 'a', 'b' ]
		)
	} )

	it( 'should select chat status', () => {
		equal(
			getChatStatus( 'a', { chatlist: { a: [ 'status' ] } } ),
			'status'
		)
	} )

	it( 'should select operator abandoned chats', () => {
		deepEqual(
			getOperatorAbandonedChats( 'id', { chatlist: {
				1: [ STATUS_ABANDONED, '1', { id: 'id' } ],
				2: [ STATUS_ABANDONED, '2', { id: 'id2' } ],
				3: [ STATUS_PENDING, '3', { id: 'id' } ],
				4: [ STATUS_PENDING, '4', { id: 'id2' } ]
			} } ),
			[ '1' ]
		)
	} )

	it( 'should select chat with status', ()=> {
		deepEqual(
			getChatsWithStatus( STATUS_PENDING, { chatlist: {
				id: [ STATUS_PENDING, { id: 'id' } ],
				id2: [ STATUS_PENDING, { id: 'id2' } ],
				id3: [ STATUS_ASSIGNED, { id: 'id2' } ]
			} } ),
			[ { id: 'id' }, { id: 'id2' } ]
		)
	} )

	it( 'should insert pending chat', dispatchAction(
		insertPendingChat( { id: 'chat-id' } ),
		state => {
			const status = getChatStatus( 'chat-id', state )
			equal( status, STATUS_PENDING )
		}
	) )

	it( 'should set chat closed', dispatchAction(
		closeChat( 'some-chat' ),
		state => {
			deepEqual( getChatStatus( 'some-chat', state ), STATUS_CLOSED )
		},
		{ 'some-chat': 'a', 'other-chat': 'b'}
	) )

	it( 'should add operator as member', dispatchAction(
		operatorChatJoin( 'id', { id: 'user' } ),
		state => {
			const [ , , , , members ] = state.chatlist.id
			deepEqual( members, { user: true } )
		},
		{ id: [ 'open', { id: 'id' }, {}, 1, {} ] }
	) )

	it( 'should remove operator as member', dispatchAction(
		operatorChatLeave( 'id', { id: 'user' } ),
		state => {
			const [ , , , , members ] = state.chatlist.id
			deepEqual( members, {} )
		},
		{ id: [ 'open', { id: 'id' }, {}, 1, { user: true } ] }
	) )

	it( 'should add operator as member when joined', dispatchAction(
		operatorJoinChat( { id: 'chat_id'}, { id: 'operator' } ),
		state => {
			deepEqual( state.chatlist.chat_id[4], { operator: true } )
		},
		{ chat_id: ['open', { id: 'chat_id'}, { id: 'operator' }, 1, {} ] }
	) )

	it( 'should remove operator as member with int id', dispatchAction(
		operatorChatLeave( 'id', { id: 1 } ),
		state => {
			const [ , , , , members ] = state.chatlist.id
			deepEqual( members, {} )
		},
		{ id: [ 'open', { id: 'id' }, {}, 1, { 1: true } ] }
	) )

	it( 'should set operator chats abandoned', dispatchAction(
		setOperatorChatsAbandoned( 'op-id' ),
		state => {
			deepEqual( state, { chatlist: {
				a: [ STATUS_ABANDONED, 'a', { id: 'op-id' } ],
				2: [ STATUS_ABANDONED, '2', { id: 'op-id' } ],
				3: [ STATUS_ABANDONED, '3', { id: 'op-id' } ],
				4: [ STATUS_PENDING, '4', { id: 'other' } ]
			} } )
		},
		{
			a: [ STATUS_ASSIGNED, 'a', { id: 'op-id' } ],
			2: [ STATUS_ASSIGNED, '2', { id: 'op-id' } ],
			3: [ STATUS_ASSIGNED, '3', { id: 'op-id' } ],
			4: [ STATUS_PENDING, '4', { id: 'other' } ]
		}
	) )

	it( 'should set chats recovered', dispatchAction(
		setChatsRecovered( [ 'a', '3' ], { id: 'op-id' } ),
		state => {
			deepEqual( state, { chatlist: {
				a: [ STATUS_ASSIGNED, 'a', { id: 'op-id' }, 1, { 'op-id': true } ],
				2: [ STATUS_ABANDONED, '2', { id: 'op-id' }, 2, {} ],
				3: [ STATUS_ASSIGNED, '3', { id: 'op-id' }, 3, { 'op-id': true } ],
				4: [ STATUS_PENDING, '4', { id: 'other' }, 4, {} ]
			} } )
		},
		{
			a: [ STATUS_ABANDONED, 'a', { id: 'op-id' }, 1, {} ],
			2: [ STATUS_ABANDONED, '2', { id: 'op-id' }, 2, {} ],
			3: [ STATUS_ABANDONED, '3', { id: 'op-id' }, 3, {} ],
			4: [ STATUS_PENDING, '4', { id: 'other' }, 4, {} ]
		}	) )

	it( 'should serialize only assigned chats', dispatchAction(
			serializeAction(),
			state => {
				deepEqual( state, { chatlist: {
					a: [ STATUS_ASSIGNED, 'a', { id: 'op-id' }, 1, {} ],
					4: [ STATUS_ASSIGNED, '4', { id: 'other' }, 4, {} ]
				} } )
			},
		{
			a: [ STATUS_ASSIGNED, 'a', { id: 'op-id' }, 1, {} ],
			2: [ STATUS_ABANDONED, '2', { id: 'op-id' }, 2, {} ],
			3: [ STATUS_ABANDONED, '3', { id: 'op-id' }, 3, {} ],
			4: [ STATUS_ASSIGNED, '4', { id: 'other' }, 4, {} ]
		}	) )

	it( 'should close chat when id is int', dispatchAction(
		closeChat( 451 ),
		state => {
			deepEqual( getChatStatus( 451, state ), STATUS_CLOSED )
		},
		{ 451: [null, { id: '451' }, null, null, null ] }
	) )

	it( 'should remove a chat', dispatchAction(
		removeChat( 123 ),
		state => deepEqual( state, { chatlist: {} } ),
		{ 123: [ ] }
	) )
} )
