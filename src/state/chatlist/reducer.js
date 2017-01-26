
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
	lensIndex,
	assoc,
	not,
	equals,
	both,
} from 'ramda'
import asString from '../as-string'
import {
	INSERT_PENDING_CHAT,
	SET_CHAT_OPERATOR,
	SET_OPERATOR_CHATS_ABANDONED,
	SET_CHATS_RECOVERED,
	SET_CHAT_CUSTOMER_DISCONNECT,
	ASSIGN_CHAT,
	SET_CHAT_MISSED,
	CLOSE_CHAT,
	AUTOCLOSE_CHAT,
	OPERATOR_JOIN,
	OPERATOR_OPEN_CHAT_FOR_CLIENTS,
	SET_USER_OFFLINE,
	REMOVE_USER,
	OPERATOR_CHAT_LEAVE,
	OPERATOR_CHAT_JOIN,
	UPDATE_CHAT,
	REMOVE_CHAT
} from '../action-types'

export const STATUS_NEW = 'new'
export const STATUS_PENDING = 'pending'
export const STATUS_MISSED = 'missed'
export const STATUS_ASSIGNED = 'assigned'
export const STATUS_ASSIGNING = 'assigning'
export const STATUS_ABANDONED = 'abandoned'
export const STATUS_CUSTOMER_DISCONNECT = 'customer-disconnect'
export const STATUS_CLOSED = 'closed'

const statusLens = lensIndex( 0 )
const chatLens = lensIndex( 1 )
const operatorLens = lensIndex( 2 )
const timestampLens = lensIndex( 3 )
const membersLens = lensIndex( 4 )
const localeLens = lensIndex( 5 )
const groupsLens = lensIndex( 6 )

export const statusView = view( statusLens )
export const chatView = view( chatLens )
export const operatorView = view( operatorLens )
export const timestampView = view( timestampLens )
export const membersView = view( membersLens )
export const localeView = view( localeLens )
export const groupsView = view( groupsLens )

const setStatus = set( statusLens )
const setChat = set( chatLens )
const setOperator = set( operatorLens )
const setTimestamp = set( timestampLens )
const setMembers = set( membersLens )
const setLocale = set( localeLens )
const setGroups = set( groupsLens )

const timestamp = () => ( new Date() ).getTime()

const chat = ( state = [ null, null, null, null, {} ], action ) => {
	switch ( action.type ) {
		case INSERT_PENDING_CHAT:
			return compose(
				setStatus( STATUS_PENDING ),
				setTimestamp( timestamp() ),
				setChat( action.chat ),
				setLocale( action.chat.locale ),
				setGroups( action.chat.groups )
			)( state )
		case UPDATE_CHAT:
			return setChat( action.chat )( state );
		case CLOSE_CHAT:
		case AUTOCLOSE_CHAT:
			return setStatus( STATUS_CLOSED, state );
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
		case SET_USER_OFFLINE:
		case REMOVE_USER:
			return setMembers( dissoc( asString( action.user.id ), membersView( state ) ), state )
		case OPERATOR_CHAT_JOIN:
		case OPERATOR_JOIN:
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
const whereStatusIsNot = status => compose(
	not,
	equals( status ),
	statusView
)

export default ( state = {}, action ) => {
	switch ( action.type ) {
		case REMOVE_CHAT:
			return dissoc( asString( action.id ), state )
		case AUTOCLOSE_CHAT:
			return assoc( action.id, chat( view( lensProp( action.id ), state ), action ), state )
		case SET_CHAT_MISSED:
		case SET_CHAT_OPERATOR:
		case OPERATOR_CHAT_JOIN:
		case OPERATOR_CHAT_LEAVE:
		case SET_CHAT_CUSTOMER_DISCONNECT:
		case CLOSE_CHAT:
			const chatIdLens = lensProp( action.chat_id )
			return set( chatIdLens, chat( view( chatIdLens, state ), action ) )( state )
		case INSERT_PENDING_CHAT:
		case OPERATOR_OPEN_CHAT_FOR_CLIENTS:
		case ASSIGN_CHAT:
		case OPERATOR_JOIN:
		case UPDATE_CHAT:
			const lens = lensProp( action.chat.id )
			return assoc( asString( action.chat.id ), chat( view( lens, state ), action ) )( state )
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
				when(
					both(
						whereOperatorIs( action.operator_id ),
						whereStatusIsNot( STATUS_CLOSED )
					),
					value => chat( value, action )
				)
			)( state )
		case REMOVE_USER:
		case SET_USER_OFFLINE:
			return map( ( chatState ) => chat( chatState, action ), state )
	}
	return state
}
