import assign from 'lodash/assign'
import set from 'lodash/set'
import get from 'lodash/get'
import defaults from 'lodash/defaults'
import concat from 'lodash/concat'
import values from 'lodash/values'
import reject from 'lodash/reject'
import omit from 'lodash/omit'
import reduce from 'lodash/reduce'
import { combineReducers } from 'redux'

import {
	UPDATE_IDENTITY,
	REMOVE_USER,
	REMOVE_USER_SOCKET,
	UPDATE_USER_STATUS,
	UPDATE_USER_CAPACITY,
	INCREMENT_USER_LOAD,
	DECREMENT_USER_LOAD,
	UPDATE_AVAILABILITY,
	OPERATOR_CLOSE_CHAT
} from './actions'

// Selectors
export const selectIdentities = ( { operators: { identities } } ) => values( identities )
export const selectSocketIdentity = ( { operators: { sockets, identities } }, socket ) => get(
	identities,
	get( sockets, socket.id )
)
export const selectUser = ( { operators: { identities } }, userId ) => get( identities, userId )
export const selectTotalCapacity = ( { operators: { identities } }, matchingStatus ) => reduce( identities,
	( { load: totalLoad, capacity: totalCapacity }, { load, capacity, status } ) => ( {
		load: totalLoad + ( status === matchingStatus ? load : 0 ),
		capacity: totalCapacity + ( status === matchingStatus ? capacity : 0 )
	} ),
	{ load: 0, capacity: 0 }
)

// Reducers
const user_sockets = ( state = {}, action ) => {
	const { user, socket } = action
	switch ( action.type ) {
		case UPDATE_IDENTITY:
			return assign( {}, state, set( {}, user.id, concat(
				get( state, user.id, [] ), socket.id )
			) )
		case REMOVE_USER_SOCKET:
			const sockets = get( state, user.id, [] )
			return assign( {}, state, set( {}, user.id, reject( sockets, socket.id ) ) )
		case REMOVE_USER:
			return omit( state, user.id )
		default:
			return state
	}
}

const userPropUpdater = prop => ( action, state ) => {
	const val = get( action, prop );
	const { user } = action;
	const newProp = set( {}, prop, val );
	const updatedUser = assign( {}, get( state, user.id ), newProp );
	return assign( {}, state, set( {}, user.id, updatedUser ) );
}
const setStatus = userPropUpdater( 'status' );
const setCapacity = userPropUpdater( 'capacity' );
const setLoad = userPropUpdater( 'load' );
const getLoad = ( user, state ) => get( state, `${user.id}.load`, 0 )

const setOpAvailability = ( opsStatuses, state ) => {
	return opsStatuses.reduce( ( collection, { id, load, capacity } ) => {
		if ( !id ) {
			return collection;
		}
		const updatedUser = assign( {}, get( state, id ), { load, capacity } )
		return assign( {}, collection, set( {}, id, updatedUser ) )
	}, state );
}

const identities = ( state = {}, action ) => {
	const { user } = action
	switch ( action.type ) {
		case UPDATE_IDENTITY:
			const userWithDefaults = defaults( user, { load: 0, capacity: 0 } );
			return assign( {}, state, set( {}, user.id, userWithDefaults ) );
		case UPDATE_USER_STATUS:
			return setStatus( action, state );
		case UPDATE_USER_CAPACITY:
			return setCapacity( action, state );
		case REMOVE_USER:
			return omit( state, user.id )
		case UPDATE_AVAILABILITY:
			return setOpAvailability( action.availability, state );
		case INCREMENT_USER_LOAD:
			const incrementedLoad = getLoad( user, state ) + action.amount;
			return setLoad( { user, load: incrementedLoad }, state );
		case DECREMENT_USER_LOAD:
		case OPERATOR_CLOSE_CHAT:
			const decrementCurrentLoad = getLoad( user, state ) - 1;
			return setLoad( { user, load: decrementCurrentLoad }, state );
		default:
			return state
	}
}

const sockets = ( state = {}, action ) => {
	const { user, socket } = action
	switch ( action.type ) {
		case UPDATE_IDENTITY:
			return assign( {}, state, set( {}, socket.id, user.id ) )
		default:
			return state
	}
}

export default () => combineReducers( {
	user_sockets,
	identities,
	sockets
} )
