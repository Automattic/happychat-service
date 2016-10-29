import { deepEqual, equal, ok } from 'assert'
import {
	reducer,
	// selectors
	getChatsForOperator,
	getMissedChats,
	getChatStatus,
	getAllChats,
	getOperatorAbandonedChats,
	getChatsWithStatus,
	havePendingChat,
	// actions
	insertPendingChat,
	closeChat,
	setChatStatus,
	setChatsAbandoned,
	setOperatorChatsAbandoned,
	// constants
	STATUS_PENDING,
	STATUS_MISSED,
	STATUS_ABANDONED,
	STATUS_ASSIGNED
} from 'state/chat-list'
import { createStore } from 'redux'

const debug = require( 'debug' )( 'happychat:test' )

const defaultState = () => createStore( reducer ).getState()

const dispatchAction = ( action, subscriber, state = defaultState() ) => () => new Promise( resolve => {
	const { getState, subscribe, dispatch } = createStore( reducer, state )
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
			getChatsForOperator( 'op-id', {
				chat1: [ 'status', 'chat1', { id: 'op-id' } ],
				chat2: ['status', 'chat2', { id: 'other-id' } ],
				chat3: ['status', 'chat3', { id: 'op-id' } ]
			} ),
			[ 'chat1', 'chat3' ]
		)
	} )

	it( 'should select missed chats', () => {
		deepEqual(
			getMissedChats( {
				id: [ STATUS_MISSED, 'a' ],
				id2: [ STATUS_MISSED, 'b' ],
				id3: ['other', 'c']
			} ),
			[ 'a', 'b' ]
		)
	} )

	it( 'should select all chats', () => {
		deepEqual(
			getAllChats( { 1: [null, 'a'], 2: [null, 'b'] } ),
			[ 'a', 'b' ]
		)
	} )

	it( 'should select chat status', () => {
		equal(
			getChatStatus( 'a', { a: [ 'status' ] } ),
			'status'
		)
	} )

	it( 'should select operator abandoned chats', () => {
		deepEqual(
			getOperatorAbandonedChats( 'id', {
				1: [ STATUS_ABANDONED, '1', { id: 'id' } ],
				2: [ STATUS_ABANDONED, '2', { id: 'id2' } ],
				3: [ STATUS_PENDING, '3', { id: 'id' } ],
				4: [ STATUS_PENDING, '4', { id: 'id2' } ]
			} ),
			[ '1' ]
		)
	} )

	it( 'should select chat with status', ()=> {
		deepEqual(
			getChatsWithStatus( STATUS_PENDING, {
				id: [ STATUS_PENDING, { id: 'id' } ],
				id2: [ STATUS_PENDING, { id: 'id2' } ],
				id3: [ STATUS_ASSIGNED, { id: 'id2' } ]
			} ),
			[ { id: 'id' }, { id: 'id2' } ]
		)
	} )

	it( 'should have pending chat', () => {
		ok( havePendingChat( {
			id: [ STATUS_PENDING, { id: 'id' } ]
		} ) )
	} )

	it( 'should insert pending chat', dispatchAction(
		insertPendingChat( { id: 'chat-id' } ),
		state => {
			deepEqual(
				state,
				{ 'chat-id': [ STATUS_PENDING, { id: 'chat-id' }, null ] }
			)
		}
	) )

	it( 'should remove closed chat', dispatchAction(
		closeChat( 'some-chat' ),
		state => {
			deepEqual( state, { 'other-chat': 'b' } )
		},
		{ 'some-chat': 'a', 'other-chat': 'b' }
	) )

	it( 'should set chat status', dispatchAction(
		setChatStatus( { id: 'chat-id' }, STATUS_PENDING ),
		state => equal( getChatStatus( 'chat-id', state ), STATUS_PENDING )
	) )

	it( 'should set chats abandoned', dispatchAction(
		setChatsAbandoned( [ 'a', 2, '3' ] ),
		state => {
			deepEqual( state, {
				a: [ STATUS_ABANDONED, 'a', 'op' ],
				2: [ STATUS_ABANDONED, '2', 'op' ],
				3: [ STATUS_ABANDONED, '3', 'op' ],
				4: [ STATUS_PENDING, '4', 'op' ]
			} )
		},
		{
			a: [ STATUS_MISSED, 'a', 'op' ],
			2: [ STATUS_MISSED, '2', 'op' ],
			3: [ STATUS_MISSED, '3', 'op' ],
			4: [ STATUS_PENDING, '4', 'op' ]
		}
	) )

	it( 'should set operator chats abandoned', dispatchAction(
		setOperatorChatsAbandoned( 'op-id' ),
		state => {
			deepEqual( state, {
				a: [ STATUS_ABANDONED, 'a', { id: 'op-id' } ],
				2: [ STATUS_ABANDONED, '2', { id: 'op-id' } ],
				3: [ STATUS_ABANDONED, '3', { id: 'op-id' } ],
				4: [ STATUS_PENDING, '4', { id: 'other' } ]
			} )
		},
		{
			a: [ STATUS_PENDING, 'a', { id: 'op-id' } ],
			2: [ STATUS_PENDING, '2', { id: 'op-id' } ],
			3: [ STATUS_PENDING, '3', { id: 'op-id' } ],
			4: [ STATUS_PENDING, '4', { id: 'other' } ]
		}
	) )
} )
