import {
	ADD_GROUP,
	REMOVE_GROUP,
	ADD_GROUP_MEMBER,
	REMOVE_GROUP_MEMBER,
	UPDATE_OPERATOR_MEMBERSHIP
} from '../action-types';
import { allowRemote } from '../operator/can-remote-dispatch';
import { DEFAULT_GROUP_ID } from './reducer';

/**
 * Add a new group to the system. Will override a group the the same id.
 *
 * @param { string } id - id for the group
 * @param { string } name - user visible name for the group
 * @param { boolean } exclusive - chats in this group require an operator in this group
 * @returns { Object } redux action
 */
export const addGroup = ( id, name, exclusive ) => ( {
	type: ADD_GROUP, id, name, exclusive
} );

/**
 * Remove the group with the given ID.
 *
 * @param { string } id - id for the group
 * @returns { Object } redux action
 */
export const removeGroup = ( id ) => ( {
	type: REMOVE_GROUP, id
} );

/**
 * Add an operator to as a member of a group
 *
 * @param { string } group_id - id of the group the member is joining
 * @param { string } operator_id - id of the operator joining the group
 * @returns { Object } redux action
 */
export const addGroupMember = ( group_id, operator_id ) => ( {
	type: ADD_GROUP_MEMBER, group_id, operator_id
} );

/**
 * Remove operator from a group
 *
 * @param { string } group_id - id of the group to remove the member from
 * @param { string } operator_id - id of the operator leaving the group
 * @returns { Object } redux action
 */
export const removeGroupMember = ( group_id, operator_id ) => ( {
	type: REMOVE_GROUP_MEMBER, group_id, operator_id
} );

/**
 * Remote dispatchable action for operators to join/leave a group
 *
 * @param group_id - the id of the group the operator is joining/leaving
 * @param isMember - wether the operator will be a member or not
 */
export const updateOperatorMembership = allowRemote(
	UPDATE_OPERATOR_MEMBERSHIP,
	( group_id, isMember ) => ( { group_id, isMember } )
);

/**
 * Update the visible label of the default group.
 *
 * @param { string } name - the label for the group
 * @returns { Object } redux action
 */
export const setDefaultGroupName = name => ( {
	type: ADD_GROUP, id: DEFAULT_GROUP_ID, name
} );
