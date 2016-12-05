export const ADD_GROUP = 'ADD_GROUP'
export const REMOVE_GROUP = 'REMOVE_GROUP'
export const ADD_GROUP_MEMBER = 'ADD_GROUP_MEMBER'
export const REMOVE_GROUP_MEMBER = 'REMOVE_GROUP_MEMBER'

export const addGroup = ( id, name, priority ) => ( {
	type: ADD_GROUP, id, name, priority
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
