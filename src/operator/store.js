import assign from 'lodash/assign'
import set from 'lodash/set'
import get from 'lodash/get'
import concat from 'lodash/concat'
import values from 'lodash/values'
import reject from 'lodash/reject'
import omit from 'lodash/omit'
import { combineReducers } from 'redux'

const debug = require( 'debug' )( 'happychat:operator:store' )

export const selectIdentities = ( { identities } ) => values( identities )
export const selectSocketIdentity = ( { sockets, identities }, socket ) => get(
	identities,
	get( sockets, socket.id )
)
export const selectUser = ( { identities }, userId ) => get( identities, userId )

const UPDATE_IDENTITY = 'UPDATE_IDENTITY'
const REMOVE_USER = 'REMOVE_USER'
const REMOVE_USER_SOCKET = 'REMOVE_USER_SOCKET'
const UPDATE_USER_STATUS = 'UPDATE_USER_STATUS'
const UPDATE_USER_MAX_CONCURRENCY = 'UPDATE_USER_MAX_CONCURRENCY'

export const updateIdentity = ( socket, user ) => {
	return { socket, user, type: UPDATE_IDENTITY }
}

export const removeUser = user => {
	return { user, type: REMOVE_USER }
}

export const removeUserSocket = ( socket, user ) => {
	return { user, socket, type: REMOVE_USER_SOCKET }
}

export const updateUserStatus = ( user, status ) => {
	return { user, status, type: UPDATE_USER_STATUS }
}

export const updateMaxConcurrency = ( user, maxConcurrency ) => {
	return { user, maxConcurrency, type: UPDATE_USER_MAX_CONCURRENCY }
}

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

// const updateUserProp = ( prop, action, state ) => {
// 	const val = get( action, prop );
// 	const { user } = action;
// 	const updated = assign( {}, get( state, user.id ), { prop: val } )
// 	return assign( {}, state, set( {}, user.id, updated ) );
// }

const identities = ( state = {}, action ) => {
	const { user } = action
	switch ( action.type ) {
		case UPDATE_IDENTITY:
			return assign( {}, state, set( {}, user.id, user ) )
		case UPDATE_USER_STATUS:
			// return updateUserProp( 'status', action, state );
			const { status } = action
			const updated = assign( {}, get( state, user.id ), { status } )
			return assign( {}, state, set( {}, user.id, updated ) );
		case UPDATE_USER_MAX_CONCURRENCY:
			// return updateUserProp( 'maxConcurrency', action, state );
			const { maxConcurrency } = action;
			debug( `setting maxConcurrency for ${user.id} to ${maxConcurrency}` );
			const updated2 = assign( {}, get( state, user.id ), { maxConcurrency } )
			return assign( {}, state, set( {}, user.id, updated2 ) );
		case REMOVE_USER:
			return omit( state, user.id )
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
