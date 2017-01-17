import {
	ADD_GROUP,
	REMOVE_GROUP,
	ADD_GROUP_MEMBER,
	REMOVE_GROUP_MEMBER,
	UPDATE_OPERATOR_GROUP_CAPACITY
} from '../action-types'
import { allowRemote } from '../operator/can-remote-dispatch'

export const addGroup = allowRemote(
	ADD_GROUP,
	( id, name, priority ) => ( { id, name, priority } )
)

export const removeGroup = ( id ) => ( {
	type: REMOVE_GROUP, id
} )

export const addGroupMember = ( group_id, operator_id, capacity ) => ( {
	type: ADD_GROUP_MEMBER, group_id, operator_id, capacity
} )

export const removeGroupMember = ( group_id, operator_id ) => ( {
	type: REMOVE_GROUP_MEMBER, group_id, operator_id
} )

export const updateOperatorGroupCapacity = allowRemote(
	UPDATE_OPERATOR_GROUP_CAPACITY,
	( group_id, capacity ) => ( { group_id, capacity } )
)
