import {
	add,
	always,
	compose,
	defaultTo,
	equals,
	evolve,
	ifElse,
	map,
	merge,
	reduce,
	mapObjIndexed
} from 'ramda'

import {
	ASSIGN_NEXT_CHAT,
	AUTOCLOSE_CHAT,
	CLOSE_CHAT,
	OPERATOR_CHAT_LEAVE,
	OPERATOR_CHAT_JOIN,
	OPERATOR_JOIN,
	OPERATOR_OPEN_CHAT_FOR_CLIENTS,
	REMOTE_ACTION_TYPE,
	REMOVE_USER,
	SET_CHAT_OPERATOR,
	SET_CHATS_RECOVERED,
	SET_OPERATOR_CAPACITY,
	SET_OPERATOR_IGNORE_CAPACITY,
	SET_OPERATOR_STATUS,
	SET_USER_LOADS,
	SET_USER_OFFLINE
} from '../../action-types'
import { getSystemAcceptsCustomers } from '../../operator/selectors'
import { setUserLoads } from '../../operator/actions'
import { assignNextChat } from '../../chatlist/actions'
import { getOpenChatMembers } from '../../chatlist/selectors'

const setOrAddOne = ifElse( equals( true ), always( 1 ), add( 1 ) )

const sumMemberships = ( total, members ) => evolve(
	// map all keys of members to a function that evolves the merged arguments
	// by setting any with true to 1 or if not true then incrementing by one
	map( () => setOrAddOne, defaultTo( {}, members ) ),
	// merge total into members to fill any keys that aren't present
	merge( members, total )
)
const reducer = compose(
	mapObjIndexed(
		reduce( sumMemberships, {} )
	),
	getOpenChatMembers
)

const handleSetUserLoads = ( { dispatch, getState }, next, action ) => {
	const result = next( action );
	if ( getSystemAcceptsCustomers( getState() ) ) {
		dispatch( assignNextChat() )
	}
	return result;
}

export default ( { getState, dispatch } ) => next => action => {
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
		case SET_OPERATOR_IGNORE_CAPACITY:
		case SET_OPERATOR_STATUS:
		case REMOVE_USER:
		case SET_USER_OFFLINE:
		case AUTOCLOSE_CHAT:
			const result = next( action )
			dispatch( setUserLoads( reducer( getState() ) ) )
			return result;
	}

	// get user load/capacity before and after, if the load changes
	// get system load before and after action
	return next( action )
}
