import {
	getChatMembers
} from '../../chat-list/selectors';
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
export default ( { getState, dispatch } ) => next => action => {
	// These actions can be ignored, they don't change load status
	switch ( action.type ) {
		case SET_USER_LOADS:
		case REMOTE_ACTION_TYPE:
			return next( action )
	}

	// get user load/capacity before and after, if the load changes

	const result = next( action )
	// update operator loads by aggregating the members of a chat
	// TODO: async?, this should probably only happen one certain action types
	dispatch( setUserLoads( reducer( getState() ) ) )
	return result
}
