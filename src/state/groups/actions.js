import {
	ADD_GROUP,
	REMOVE_GROUP,
	ADD_GROUP_MEMBER,
	REMOVE_GROUP_MEMBER,
	UPDATE_OPERATOR_MEMBERSHIP
} from '../action-types'
import { allowRemote } from '../operator/can-remote-dispatch'

export const addGroup = ( id, name, exclusive ) => ( {
	type: ADD_GROUP, id, name, exclusive
} )

export const removeGroup = ( id ) => ( {
	type: REMOVE_GROUP, id
} )

export const addGroupMember = ( group_id, operator_id ) => ( {
	type: ADD_GROUP_MEMBER, group_id, operator_id
} )

export const removeGroupMember = ( group_id, operator_id ) => ( {
	type: REMOVE_GROUP_MEMBER, group_id, operator_id
} )

export const updateOperatorMembership = allowRemote(
	UPDATE_OPERATOR_MEMBERSHIP,
	( group_id, isMember ) => ( { group_id, isMember } )
)
