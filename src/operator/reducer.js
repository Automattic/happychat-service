import assign from 'lodash/assign'
import set from 'lodash/set'
import get from 'lodash/get'
import defaults from 'lodash/defaults'
import concat from 'lodash/concat'
import reject from 'lodash/reject'
import omit from 'lodash/omit'
import { REMOTE_USER_KEY } from './canRemoteDispatch'
import { combineReducers } from 'redux'
import {
	mapObjIndexed,
	defaultTo,
	merge,
	lensProp,
	view,
	set as set_ramda
} from 'ramda'

import {
	UPDATE_IDENTITY,
	REMOVE_USER,
	REMOVE_USER_SOCKET,
	UPDATE_USER_STATUS,
	UPDATE_USER_CAPACITY,
	SET_SYSTEM_ACCEPTS_CUSTOMERS,
	SET_USER_LOADS,
	SET_OPERATOR_CAPACITY
} from './actions'

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

const identities = ( state = {}, action ) => {
	const { user } = action
	switch ( action.type ) {
		case UPDATE_IDENTITY:
			const userWithDefaults = defaults( user, { load: 0, capacity: 0 } );
			return assign( {}, state, set( {}, user.id, userWithDefaults ) );
		case UPDATE_USER_STATUS:
			return setStatus( action, state );
		case SET_OPERATOR_CAPACITY:
			const lens = lensProp( action[REMOTE_USER_KEY].id )
			return set_ramda( lens,
				merge(
					view( lens, state ),
					{ capacity: parseInt( action.capacity ) }
				),
				state
			)
		case UPDATE_USER_CAPACITY:
			return setCapacity( action, state );
		case REMOVE_USER:
			return omit( state, user.id )
		case SET_USER_LOADS:
			return mapObjIndexed( ( operator, id ) => merge(
				operator,
				{ load: defaultTo( 0, action.loads[id] ) }
			), state )
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

const system = ( state = { acceptsCustomers: false }, action ) => {
	switch ( action.type ) {
		case SET_SYSTEM_ACCEPTS_CUSTOMERS:
			return assign( {}, state, { acceptsCustomers: action.isEnabled } )
	}
	return state
}

export default combineReducers( {
	user_sockets,
	identities,
	sockets,
	system
} )
