import assign from 'lodash/assign'
import set from 'lodash/set'
import get from 'lodash/get'
import concat from 'lodash/concat'
import reject from 'lodash/reject'
import omit from 'lodash/omit'
import { REMOTE_USER_KEY } from '../middlewares/socket-io/broadcast'
import { combineReducers } from 'redux'
import {
	merge,
	lensPath,
	lensProp,
	set as set_ramda,
	compose,
	view,
	map,
	exclude,
	mergeAll
} from 'ramda'
import asString from '../as-string'
import {
	UPDATE_IDENTITY,
	REMOVE_USER,
	REMOVE_USER_SOCKET,
	SET_SYSTEM_ACCEPTS_CUSTOMERS,
	SET_OPERATOR_STATUS,
	SET_OPERATOR_REQUESTING_CHAT,
	SET_USER_OFFLINE,
	SERIALIZE,
	DESERIALIZE
} from '../action-types'

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

const identity = ( state = { online: false, requestingChat: false }, action ) => {
	switch ( action.type ) {
		case SERIALIZE:
			return exclude( [ 'capacity', 'load', 'requestingChat' ], state )
		case DESERIALIZE:
			return merge( state, { online: false, requestingChat: false } )
		case UPDATE_IDENTITY:
			return mergeAll( [ state, action.user, { online: true } ] )
		case SET_OPERATOR_STATUS:
			return merge( state, { status: action.status, online: true, requestingChat: false } )
		case SET_USER_OFFLINE:
			return merge( state, { status: 'unavailable', online: false } );
		case SET_OPERATOR_REQUESTING_CHAT:
			return merge( state, { requestingChat: action.requestingChat } )
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

export const getRemoteActionUser = view( lensProp( REMOTE_USER_KEY ) )

const identities = ( state = {}, action ) => {
	const { user } = action
	switch ( action.type ) {
		case DESERIALIZE:
			return map( identityState => identity( identityState, action ), state )
		case UPDATE_IDENTITY:
		case SET_USER_OFFLINE:
			const lens = lensUser( action )
			return set_ramda(
				lens,
				identity( view( lens, state ), action )
			)( state )
		case SET_OPERATOR_REQUESTING_CHAT:
		case SET_OPERATOR_STATUS:
			return set_ramda(
				lensRemoteUser( action ),
				identity( view( lensRemoteUser( action ), state ), action )
			)( state )
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
