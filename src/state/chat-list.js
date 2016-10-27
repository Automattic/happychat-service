import {
	filter,
	compose,
	values,
	whereEq,
	lensIndex,
	lensProp,
	set,
	map,
	view,
	equals,
	dissoc,
	reduce,
	when,
	both,
	defaultTo,
	merge
} from 'ramda'

import { makeEventMessage } from '../util'

const debug = require( 'debug' )( 'happychat:chat-list:redux' )

export const STATUS_NEW = 'new'
export const STATUS_PENDING = 'pending'
export const STATUS_MISSED = 'missed'
const STATUS_ASSIGNED = 'assigned'
export const STATUS_ABANDONED = 'abandoned'
const STATUS_CUSTOMER_DISCONNECT = 'customer-disconnect'

const BROADCAST_CHATS = 'BROADCAST_CHATS'
export const broadcastChats = ( socket ) => ( {
	type: BROADCAST_CHATS, socket
} )

const RECEIVE_CUSTOMER_MESSAGE = 'RECEIVE_CUSTOMER_MESSAGE'
export const receiveCustomerMessage = ( chat, message ) => ( {
	type: RECEIVE_CUSTOMER_MESSAGE, chat, message
} )

const ASSIGN_MISSED_CHAT = 'ASSIGN_MISSED_CHAT'
export const assignMissedChat = () => ( {
	type: ASSIGN_MISSED_CHAT
} )

const REASSIGN_CHATS = 'REASSIGN_CHATS'
export const reassignChats = ( operator ) => ( {
	type: REASSIGN_CHATS, operator
} )

const SET_CHATS_ABANDONED = 'SET_CHATS_ABANDONED'
export const setChatsAbandoned = ( chat_ids ) => ( {
	type: SET_CHATS_ABANDONED, chat_ids
} )

const SET_OPERATOR_CHATS_ABANDONED = 'SET_OPERATOR_CHATS_ABANDONED'
export const setOperatorChatsAbandoned = ( operator_id ) => ( {
	type: SET_OPERATOR_CHATS_ABANDONED, operator_id
} )

const RECOVER_CHATS = 'RECOVER_CHATS'
export const recoverChats = ( operator ) => ( {
	type: RECOVER_CHATS, operator
} )

const INSERT_PENDING_CHAT = 'INSERT_PENDING_CHAT'
export const insertPendingChat = chat => ( {
	type: INSERT_PENDING_CHAT, chat
} )

const CLOSE_CHAT = 'CLOSE_CHAT'
export const closeChat = chat => ( {
	type: CLOSE_CHAT, chat
} )

const SET_CHAT_STATUS = 'SET_CHAT_STATUS'
export const setChatStatus = ( chat, status ) => ( {
	type: SET_CHAT_STATUS, chat, status
} )

const SET_CHAT_MISSED = 'SET_CHAT_MISSED'
export const setChatMissed = ( chat_id, error ) => ( {
	type: SET_CHAT_MISSED, chat_id, error
} )

const SET_CHAT_OPERATOR = 'SET_CHAT_OPERATOR'
export const setChatOperator = ( chat_id, operator ) => ( {
	type: SET_CHAT_OPERATOR, chat_id, operator
} )

const statusLens = lensIndex( 0 )
const chatLens = lensIndex( 1 )
const operatorLens = lensIndex( 2 )

const statusView = view( statusLens )
const chatView = view( chatLens )
const operatorView = view( operatorLens )

const setStatus = set( statusLens )
const setChat = set( chatLens )
const setOperator = set( operatorLens )

const mapToChat = map( chatView )

const matchingStatus = status => filter( compose( equals( status ), statusView ) )

/*
Selects all chats assigned/associated with given operator id
*/
export const getChatsForOperator = ( operator_id, state ) => compose(
	// take the 2nd item (the chat)
	mapToChat,
	// filter the values of chat
	filter( compose(
		// compare operator.id to operator_id and match when equal
		whereEq( { id: operator_id } ),
		// take the 3rd item in chat row [STATUS, CHAT, OPERATOR]
		operatorView
	) ),
	// get the values of chat
	values
)( state )

export const getAllChats = compose( mapToChat, values )
export const getChatsWithStatus = ( status, state ) => compose(
	mapToChat,
	matchingStatus( status ),
	values
)( state )

export const getOperatorAbandonedChats = ( id, state ) => compose(
	mapToChat,
	filter( both(
		compose( whereEq( { id } ), operatorView ),
		compose( equals( STATUS_ABANDONED ), statusView )
	) ),
	values
)( state )

export const getAbandonedChats = ( state ) => getChatsWithStatus( STATUS_ABANDONED, state )
export const getMissedChats = ( state ) => getChatsWithStatus( STATUS_MISSED, state )

export const getChatOperator = ( chat_id, state ) => compose(
	operatorView,
	defaultTo( [] ),
	view( lensProp( chat_id ) )
)( state )

export const getChat = ( chat_id, state ) => compose(
	chatView,
	defaultTo( [] ),
	view( lensProp( chat_id ) )
)( state )

export const getChats = state => compose(
	mapToChat,
	values
)( state )

export const getChatStatus = ( chat_id, state ) => defaultTo( STATUS_NEW )( compose(
	statusView,
	defaultTo( [] ),
	view( lensProp( chat_id ) )
)( state ) )

export const isChatStatusNew = ( chat_id, state ) => equals( STATUS_NEW, getChatStatus( chat_id, state ) )

const chat = ( state = [ null, null, null ], action ) => {
	switch ( action.type ) {
		case INSERT_PENDING_CHAT:
			return compose(
				setStatus( STATUS_PENDING ),
				setChat( action.chat )
			)( state )
		case SET_CHAT_OPERATOR:
			return compose(
				setStatus( STATUS_ASSIGNED ),
				setOperator( action.operator )
			)( state )
		case SET_CHAT_STATUS:
			return setStatus( action.status, state )
		case SET_CHATS_ABANDONED:
		case SET_OPERATOR_CHATS_ABANDONED:
			return setStatus( STATUS_ABANDONED, state )
	}
	return state
}

const whereOperatorIs = id => compose(
	whereEq( { id } ),
	defaultTo( {} ),
	operatorView
)

const whenOperatorIs = id => when( whereOperatorIs( id ) )

export const reducer = ( state = {}, action ) => {
	switch ( action.type ) {
		case SET_CHAT_MISSED:
		case SET_CHAT_OPERATOR:
			const chatIdLens = lensProp( action.chat_id )
			return set( chatIdLens, chat( view( chatIdLens, state ), action ) )( state )
		case SET_CHAT_STATUS:
		case INSERT_PENDING_CHAT:
			const lens = lensProp( action.chat.id )
			return set( lens, chat( view( lens, state ), action ) )( state )
		case CLOSE_CHAT:
			return dissoc( action.chat.id, state )
		case SET_CHATS_ABANDONED:
			return reduce(
				( chats, chat_id ) => set(
					lensProp( chat_id ),
					chat( view( lensProp( chat_id ), chats ), action ),
					chats
				),
				state,
				action.chat_ids
			)
		case SET_OPERATOR_CHATS_ABANDONED:
			return map(
				whenOperatorIs( action.operator_id )( value => chat( value, action ) )
			)( state )

	}
	return state
}

export const middleware = ( { customers, operators, events } ) => store => {
	return next => action => {
		debug( 'received', action.type )
		const prevState = store.getState()
		const result = next( action )
		switch ( action.type ) {
			case RECEIVE_CUSTOMER_MESSAGE:
				debug( 'see if we should assign?', getChatStatus( action.chat.id, store.getState() ) )
				// select status of chat
				if ( isChatStatusNew( action.chat.id, store.getState() ) ) {
					debug( 'time to assign' )
					break
				}
				debug( 'chat exists time to make sure someone is home' )
				break
			case SET_CHAT_MISSED:
				let previousStatus = getChatStatus( action.chat_id, prevState )
				let missedChat = getChat( action.chat_id, store.getState() )
				debug( 'setChatAsMissed', action.chat_id, missedChat, previousStatus );
				if ( previousStatus !== STATUS_MISSED ) {
					events.emit( 'miss', action.error, missedChat )
				}
				// const [ status ] = get( this._chats, chat.id, [] );
				// this._chats = set( this._chats, chat.id, [ STATUS_MISSED, chat ] )
				// if ( status !== STATUS_MISSED ) {
				// 	this.emit( 'miss', error, chat )
				// }
				break;
			case SET_CHAT_OPERATOR:
				let { operator, chat_id } = action
				let chat = getChat( action.chat_id, store.getState() )
				debug( 'found', chat.id, operator.id )
				events.emit( 'chat.status', 'found', chat, operator )
				events.emit( 'found', chat, operator )
				operators.emit( 'message', chat, operator, merge( makeEventMessage( 'operator assigned', chat_id ), {
					meta: { operator, event_type: 'assigned' }
				} ) )

				break
			case BROADCAST_CHATS:
				debug( 'state', getChats( store.getState() ) )
				action.socket.emit( 'chats', getChats( store.getState() ) )
				break
			case ASSIGN_MISSED_CHAT:
				break
			default:
				debug( 'default for action', action.type )
		}
		return result
	}
}
