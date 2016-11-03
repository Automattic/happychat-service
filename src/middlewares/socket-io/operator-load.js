import {
	getChatMembers
} from '../../chat-list/selectors';
import {
	assignNextChat
} from '../../chat-list/actions'
import {
	haveAvailableCapacity
} from '../../operators/store';
import {
	setUserLoads,
	SET_USER_LOADS
} from '../../operator/actions'
import {
	REMOTE_ACTION_TYPE
} from './broadcast'
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
	equals
} from 'ramda'

const setOrAddOne = ifElse( equals( true ), always( 1 ), add( 1 ) )
const sumMemberships = ( total, members ) => evolve(
	// map all keys of members to a function that evolves the merged arguments
	// by setting any with true to 1 or if not true then incrementing by one
	map( () => setOrAddOne, defaultTo( {}, members ) ),
	// merge total into members to fill any keys that aren't present
	merge( members, total )
)
const reducer = compose( reduce( sumMemberships, {} ), getChatMembers )

const handleSetUserLoads = ( { dispatch, getState }, next, action ) => {
	const result = next( action );
	if ( haveAvailableCapacity( getState() ) ) {
		dispatch( assignNextChat() )
	}
	return result;
}
export default ( { getState, dispatch } ) => next => action => {
	// TODO: create a whitelist of actions
	switch ( action.type ) {
		// These actions can be ignored, they don't change load status
		case REMOTE_ACTION_TYPE:
			return next( action )
		// after loads are updated see if there are chats to assign in the
		// event that capacity has increased
		case SET_USER_LOADS:
			return handleSetUserLoads( { dispatch, getState }, next, action );
	}

	// get user load/capacity before and after, if the load changes
	// get system load before and after action
	const result = next( action )

	// update operator loads by aggregating the members of a chat
	dispatch( setUserLoads( reducer( getState() ) ) )
	return result
}
