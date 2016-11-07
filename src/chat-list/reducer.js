
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
	SET_OPERATOR_CHATS_ABANDONED,
	SET_CHATS_RECOVERED,
	SET_CHAT_CUSTOMER_DISCONNECT,
	ASSIGN_CHAT,
	SET_CHAT_MISSED,
	CLOSE_CHAT
} from './actions'
import {
	OPERATOR_OPEN_CHAT_FOR_CLIENTS,
	REMOVE_USER,
	OPERATOR_CHAT_LEAVE,
	OPERATOR_CHAT_JOIN,
} from '../operator/actions'
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
const timestampLens = lensIndex( 3 )
const membersLens = lensIndex( 4 )

export const statusView = view( statusLens )
export const chatView = view( chatLens )
export const operatorView = view( operatorLens )
export const timestampView = view( timestampLens )
export const membersView = view( membersLens )

const setStatus = set( statusLens )
const setChat = set( chatLens )
const setOperator = set( operatorLens )
const setTimestamp = set( timestampLens )
const setMembers = set( membersLens )

const timestamp = () => ( new Date() ).getTime()

const chat = ( state = [ null, null, null, null, {} ], action ) => {
	switch ( action.type ) {
		case INSERT_PENDING_CHAT:
			return compose(
				setStatus( STATUS_PENDING ),
				setTimestamp( timestamp() ),
				setChat( action.chat )
			)( state )
		case SET_CHAT_OPERATOR:
		case SET_CHATS_RECOVERED:
			return compose(
				setMembers( set( lensProp( action.operator.id ), true, membersView( state ) ) ),
				setStatus( STATUS_ASSIGNED ),
				setOperator( action.operator ),
			)( state )
		case SET_OPERATOR_CHATS_ABANDONED:
			return setStatus( STATUS_ABANDONED, state )
		case ASSIGN_CHAT:
			return setStatus( STATUS_ASSIGNING, state )
		case SET_CHAT_MISSED:
			return setStatus( STATUS_MISSED, state )
		case OPERATOR_CHAT_LEAVE:
		case REMOVE_USER:
			return setMembers( dissoc( action.user.id, membersView( state ) ), state )
		case OPERATOR_CHAT_JOIN:
			return setMembers( set( lensProp( action.user.id ), true, membersView( state ) ), state )
		case OPERATOR_OPEN_CHAT_FOR_CLIENTS:
			return setMembers( set( lensProp( action.operator.id ), true, membersView( state ) ), state )
		case SET_CHAT_CUSTOMER_DISCONNECT:
			return setStatus( STATUS_CUSTOMER_DISCONNECT, state )
	}
	return state
}

const whereOperatorIs = id => compose(
	whereEq( { id } ),
	defaultTo( {} ),
	operatorView
)

const whenOperatorIs = id => when( whereOperatorIs( id ) )

export default ( state = {}, action ) => {
	switch ( action.type ) {
		case SET_CHAT_MISSED:
		case SET_CHAT_OPERATOR:
		case OPERATOR_CHAT_JOIN:
		case OPERATOR_CHAT_LEAVE:
		case SET_CHAT_CUSTOMER_DISCONNECT:
			const chatIdLens = lensProp( action.chat_id )
			return set( chatIdLens, chat( view( chatIdLens, state ), action ) )( state )
		case INSERT_PENDING_CHAT:
		case OPERATOR_OPEN_CHAT_FOR_CLIENTS:
		case ASSIGN_CHAT:
			const lens = lensProp( action.chat.id )
			return set( lens, chat( view( lens, state ), action ) )( state )
		case CLOSE_CHAT:
			return dissoc( action.chat_id, state )
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
		case REMOVE_USER:
			return map( ( chatState ) => chat( chatState, action ), state )
	}
	return state
}
