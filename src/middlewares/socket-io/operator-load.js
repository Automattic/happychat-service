import { getOpenChatMembers, getChatsForOperator, getChatStatus } from '../../chat-list/selectors';
import {
	assignNextChat,
	notifySystemStatusChange,
	notifyChatStatusChanged,
	ASSIGN_NEXT_CHAT,
	SET_CHAT_MISSED,
	SET_CHAT_OPERATOR,
	SET_CHAT_CUSTOMER_DISCONNECT,
	INSERT_PENDING_CHAT,
	ASSIGN_CHAT,
	SET_CHATS_RECOVERED,
	SET_OPERATOR_CHATS_ABANDONED,
	CLOSE_CHAT,
	OPERATOR_JOIN
} from '../../chat-list/actions'
import { haveAvailableCapacity, isSystemAcceptingCustomers } from '../../operator/selectors';
import {
	setUserLoads,
	OPERATOR_CHAT_LEAVE,
	OPERATOR_CHAT_JOIN,
	SET_USER_LOADS,
	OPERATOR_OPEN_CHAT_FOR_CLIENTS,
	REMOVE_USER,
	SET_USER_OFFLINE,
	SET_OPERATOR_CAPACITY,
	SET_OPERATOR_STATUS
} from '../../operator/actions'
import { REMOTE_ACTION_TYPE } from './broadcast'
import {
	compose,
	reduce,
	add,
	evolve,
	map,
	defaultTo,
	merge,
	always,
	ifElse,
	equals,
	lensProp,
	isEmpty,
	view,
	assoc,
	mapObjIndexed
} from 'ramda'
const debug = require( 'debug' )( 'happychat:middleware:load' )
const setOrAddOne = ifElse( equals( true ), always( 1 ), add( 1 ) )
const sumMemberships = ( total, members ) => evolve(
	// map all keys of members to a function that evolves the merged arguments
	// by setting any with true to 1 or if not true then incrementing by one
	map( () => setOrAddOne, defaultTo( {}, members ) ),
	// merge total into members to fill any keys that aren't present
	merge( members, total )
)
const reducer = compose( reduce( sumMemberships, {} ), getOpenChatMembers )

const handleSetUserLoads = ( { dispatch, getState }, next, action ) => {
	const result = next( action );
	if ( haveAvailableCapacity( getState() ) ) {
		dispatch( assignNextChat() )
	}
	return result;
}

const notifySystemStatus = ( { getState, dispatch } ) => next => action => {
	const previous = isSystemAcceptingCustomers( getState() )
	const result = next( action )
	const current = isSystemAcceptingCustomers( getState() )
	if ( current !== previous ) {
		dispatch( notifySystemStatusChange( current ) )
	}
	return result;
}

const updateLoadMiddleware = ( { getState, dispatch } ) => next => action => {
	// TODO: create a whitelist of actions
	switch ( action.type ) {
		// These actions can be ignored, they don't change load status
		case REMOTE_ACTION_TYPE:
		case ASSIGN_NEXT_CHAT:
			return next( action )
		case SET_USER_LOADS:
			return handleSetUserLoads( { dispatch, getState }, next, action )
		// after loads are updated see if there are chats to assign in the
		// event that capacity has increased
		case OPERATOR_CHAT_LEAVE:
		case OPERATOR_CHAT_JOIN:
		case OPERATOR_JOIN:
		case OPERATOR_OPEN_CHAT_FOR_CLIENTS:
		case CLOSE_CHAT:
		case SET_CHAT_OPERATOR:
		case SET_CHATS_RECOVERED:
		case SET_OPERATOR_CAPACITY:
		case SET_OPERATOR_STATUS:
		case REMOVE_USER:
		case SET_USER_OFFLINE:
			const result = next( action )
			dispatch( setUserLoads( reducer( getState() ) ) )
			return result;
	}

	// get user load/capacity before and after, if the load changes
	// get system load before and after action
	return next( action )
}

const mapStatus = state => ids => reduce(
	( statuses, id ) => assoc( id, getChatStatus( id, state ), statuses ),
	{},
	ids
)

const chatStatusNotifier = ( { getState, dispatch } ) => next => action => {
	// only actions that change the status of a chat
	let chat_ids = []
	switch ( action.type ) {
		// action.chat_id
		case SET_CHAT_MISSED:
		case SET_CHAT_OPERATOR:
		case SET_CHAT_CUSTOMER_DISCONNECT:
			chat_ids = [ action.chat_id ]
			break;
		// action.chat
		case INSERT_PENDING_CHAT:
		case ASSIGN_CHAT:
			chat_ids = [ action.chat.id ]
			break;
		// action.chat_ids
		case SET_CHATS_RECOVERED:
			chat_ids = action.chat_ids
			break;
		// select chats for operator action.operator_id
		case SET_OPERATOR_CHATS_ABANDONED:
			break;
			chat_ids = map(
				view( lensProp( 'id' ) ),
				getChatsForOperator( action.operator_id, getState() )
			)
			break;
	}

	if ( isEmpty( chat_ids ) ) {
		return next( action )
	}

	const previous = mapStatus( getState() )( chat_ids )
	const result = next( action )
	const current = mapStatus( getState() )( chat_ids )
	debug( 'time to track the status of', previous, current )
	mapObjIndexed(
		( state, id ) => {
			if ( state !== previous[id] ) {
				dispatch( notifyChatStatusChanged( id, state, previous[id] ) )
			}
		},
		current
	)
	return result;
}

export default [ updateLoadMiddleware, notifySystemStatus, chatStatusNotifier ]
