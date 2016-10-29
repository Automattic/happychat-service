
import {
	compose,
	whereEq,
	lensProp,
	set,
	map,
	view,
	dissoc,
	reduce,
	when,
	defaultTo,
	lensIndex
} from 'ramda'

import {
	INSERT_PENDING_CHAT,
	SET_CHAT_OPERATOR,
	SET_CHAT_STATUS,
	SET_CHATS_ABANDONED,
	SET_OPERATOR_CHATS_ABANDONED,
	SET_CHATS_RECOVERED,
	ASSIGN_CHAT,
	SET_CHAT_MISSED,
	CLOSE_CHAT
} from './actions'

export const STATUS_NEW = 'new'
export const STATUS_PENDING = 'pending'
export const STATUS_MISSED = 'missed'
export const STATUS_ASSIGNED = 'assigned'
export const STATUS_ASSIGNING = 'assigning'
export const STATUS_ABANDONED = 'abandoned'
export const STATUS_CUSTOMER_DISCONNECT = 'customer-disconnect'

const statusLens = lensIndex( 0 )
const chatLens = lensIndex( 1 )
const operatorLens = lensIndex( 2 )

export const statusView = view( statusLens )
export const chatView = view( chatLens )
export const operatorView = view( operatorLens )

const setStatus = set( statusLens )
const setChat = set( chatLens )
const setOperator = set( operatorLens )

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
		case SET_CHATS_RECOVERED:
			return setStatus( STATUS_ASSIGNED, state )
		case ASSIGN_CHAT:
			return setStatus( STATUS_ASSIGNING, state )
		case SET_CHAT_MISSED:
			return setStatus( STATUS_MISSED, state )
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
		case ASSIGN_CHAT:
			const lens = lensProp( action.chat.id )
			return set( lens, chat( view( lens, state ), action ) )( state )
		case CLOSE_CHAT:
			return dissoc( action.chat_id, state )
		case SET_CHATS_ABANDONED:
		case SET_CHATS_RECOVERED:
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
