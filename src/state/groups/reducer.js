import { combineReducers } from 'redux'
import {
	assoc,
	dissoc,
	dissocPath,
	assocPath
} from 'ramda'
import asString from '../as-string'
import {
	ADD_GROUP,
	ADD_GROUP_MEMBER,
	REMOVE_GROUP,
	REMOVE_GROUP_MEMBER,
	UPDATE_OPERATOR_GROUP_CAPACITY
} from '../action-types'
import { REMOTE_USER_KEY } from '../middlewares/socket-io/broadcast'

export const DEFAULT_GROUP_ID = '__default'
export const DEFAULT_GROUP_NAME = 'Default'

const group = ( state = { priority: 0 }, action ) => {
	switch ( action.type ) {
		case ADD_GROUP:
			return { id: action.id, name: action.name, priority: action.priority }
	}
	return state
}

const list = ( state = { [DEFAULT_GROUP_ID]: { id: DEFAULT_GROUP_ID, name: DEFAULT_GROUP_NAME } }, action ) => {
	switch ( action.type ) {
		case REMOVE_GROUP:
			return dissoc( asString( action.id ), state )
		case ADD_GROUP:
			return assoc( asString( action.id ), group( undefined, action ) )( state )
		default:

	}
	return state
}

const memberPath = action => [ asString( action.group_id ), asString( action.operator_id ) ]

const memberships = ( state = {}, action ) => {
	switch ( action.type ) {
		case ADD_GROUP_MEMBER:
			return assocPath(
				memberPath( action ),
				action.capacity
			)( state )
		case REMOVE_GROUP_MEMBER:
			return dissocPath(
				memberPath( action ),
			)( state )
		case UPDATE_OPERATOR_GROUP_CAPACITY:
			return assocPath(
				[ asString( action.group_id ), asString( action[REMOTE_USER_KEY].id ) ],
				parseInt( action.capacity )
			)( state );
	}
	return state
}

export default combineReducers( { list, memberships } )
