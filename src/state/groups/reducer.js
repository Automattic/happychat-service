import { combineReducers } from 'redux'
import {
	assoc,
	dissoc,
	dissocPath,
	assocPath
} from 'ramda'
import { asString } from '../util'
import {
	ADD_GROUP,
	ADD_GROUP_MEMBER,
	REMOVE_GROUP,
	REMOVE_GROUP_MEMBER,
} from './actions'

const group = ( state = { priority: 0 }, action ) => {
	switch ( action.type ) {
		case ADD_GROUP:
			return { id: action.id, name: action.name, priority: action.priority }
	}
	return state
}

const list = ( state = {}, action ) => {
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
				true
			)( state )
		case REMOVE_GROUP_MEMBER:
			return dissocPath(
				memberPath( action ),
			)( state )
	}
	return state
}

export default combineReducers( { list, memberships } )
