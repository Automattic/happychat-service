import assign from 'lodash/assign'
import set from 'lodash/set'
import get from 'lodash/get'
import concat from 'lodash/concat'
import reject from 'lodash/reject'
import omit from 'lodash/omit'
import { REMOTE_USER_KEY } from '../middlewares/socket-io/broadcast'
import { combineReducers } from 'redux'
import {
	mapObjIndexed,
	defaultTo,
	merge,
	lensPath,
	lensProp,
	set as set_ramda,
	compose,
	view
} from 'ramda'
import { asString } from '../util'
import {
	UPDATE_IDENTITY,
	REMOVE_USER,
	REMOVE_USER_SOCKET,
	UPDATE_USER_STATUS,
	UPDATE_USER_CAPACITY,
	SET_SYSTEM_ACCEPTS_CUSTOMERS,
	SET_USER_LOADS,
	SET_OPERATOR_CAPACITY,
	SET_OPERATOR_STATUS,
	SET_USER_OFFLINE
} from './actions'
import { SERIALIZE } from '../'

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
		case SERIALIZE:
			return {}
		default:
			return state
	}
}

const DEFAULT_CAPACITY = 3;

const identity = ( state = { load: 0, capacity: DEFAULT_CAPACITY, online: false }, action ) => {
	switch ( action.type ) {
		case UPDATE_IDENTITY:
			return merge( state, action.user, { online: true } )
		case UPDATE_USER_STATUS:
			return merge( state, { status: action.status, online: true } )
		case UPDATE_USER_CAPACITY:
			return merge( state, { capacity: action.capacity, online: true } )
		case SET_OPERATOR_STATUS:
			return merge( state, { status: action.status, online: true } )
		case SET_OPERATOR_CAPACITY:
			const capacity = parseInt( action.capacity )
			if ( isNaN( capacity ) ) {
				return state
			}
			return merge( state, { capacity, online: true } )
		case SET_USER_OFFLINE:
			return merge( state, { online: false } )
	}
	return state
}

const lensUser = action => lensProp( compose(
	asString,
	view( lensPath( [ 'user', 'id' ] ) )
)( action ) )

const lensRemoteUser = action => lensProp( compose(
	asString,
	view( lensPath( [ REMOTE_USER_KEY, 'id' ] ) )
)( action ) );

const identities = ( state = {}, action ) => {
	const { user } = action
	switch ( action.type ) {
		case UPDATE_IDENTITY:
		case UPDATE_USER_STATUS:
		case UPDATE_USER_CAPACITY:
		case SET_USER_OFFLINE:
			return set_ramda(
				lensUser( action ),
				identity( view( lensUser( action ), state ), action )
			)( state )
		case SET_OPERATOR_STATUS:
		case SET_OPERATOR_CAPACITY:
			return set_ramda(
				lensRemoteUser( action ),
				identity( view( lensRemoteUser( action ), state ), action )
			)( state )
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
		case SERIALIZE:
			return {}
		default:
			return state
	}
}

const system = ( state = { acceptsCustomers: false }, action ) => {
	switch ( action.type ) {
		case SERIALIZE:
			return state
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
