import {
	merge,
	assoc,
	dissoc,
	dissocPath,
	assocPath,
	when,
	not,
	equals,
	always,
	compose,
	pickBy,
	isNil,
	prop
} from 'ramda'
import asString from '../as-string'
import {
	ADD_GROUP,
	ADD_GROUP_MEMBER,
	REMOVE_GROUP,
	REMOVE_GROUP_MEMBER,
	UPDATE_OPERATOR_MEMBERSHIP,
	DESERIALIZE
} from '../action-types'
import { REMOTE_USER_KEY } from '../middlewares/socket-io/broadcast'

export const DEFAULT_GROUP_ID = '__default'
export const DEFAULT_GROUP_NAME = 'Default'

const group = ( state = { exclusive: false, members: {} }, action ) => {
	switch ( action.type ) {
		case ADD_GROUP:
			return merge(
				state,
				pickBy( compose( not, isNil ), {
					id: action.id,
					name: action.name,
					exclusive: action.exclusive
				} )
			)
	}
	return state
}

const memberPath = action => [
	asString( action.group_id ),
	'members',
	asString( action.operator_id )
]

const remoteMemberPath = action => [
	asString( action.group_id ),
	'members',
	asString( action[REMOTE_USER_KEY].id )
]

export default ( state = { [DEFAULT_GROUP_ID]: { id: DEFAULT_GROUP_ID, name: DEFAULT_GROUP_NAME } }, action ) => {
	switch ( action.type ) {
		case DESERIALIZE:
			return pickBy(
				compose( not, isNil, prop( 'id' ) )
			)( state )
		case REMOVE_GROUP:
			return when(
				compose( not, equals( DEFAULT_GROUP_ID ), always( action.id ) ),
				dissoc( asString( action.id ) )
			)( state )
		case ADD_GROUP:
			return assoc( asString( action.id ), group( undefined, action ) )( state )
		case ADD_GROUP_MEMBER:
			return assocPath(
				memberPath( action ),
				true
			)( state )
		case REMOVE_GROUP_MEMBER:
			return dissocPath(
				memberPath( action ),
			)( state )
		case UPDATE_OPERATOR_MEMBERSHIP:
			if ( action.isMember ) {
				return assocPath(
					remoteMemberPath( action ),
					true
				)( state )
			}
			if ( ! action.isMember ) {
				return dissocPath(
					remoteMemberPath( action )
				)( state )
			}
			return state
	}
	return state
}
