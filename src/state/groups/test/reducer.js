import { deepEqual, equal, ok } from 'assert'
import { createStore } from 'redux'

import groups from 'state/groups/reducer'
import {
	addGroup,
	removeGroup,
	addGroupMember,
	removeGroupMember,
	updateOperatorMembership,
	setDefaultGroupName
} from 'state/groups/actions'
import { DEFAULT_GROUP_NAME, DEFAULT_GROUP_ID } from 'state/groups/reducer'
import { remoteAction } from '../../../../test/helpers'

describe( 'group reducer', () => {
	it( 'should have default state', () => {
		const { getState } = createStore( groups )
		deepEqual( getState(), {
			[ DEFAULT_GROUP_ID ]: { name: DEFAULT_GROUP_NAME, id: DEFAULT_GROUP_ID }
		} )
	} )

	it( 'should add a group', () => {
		const { getState, dispatch } = createStore( groups );
		dispatch( addGroup( 'group-id', 'Group Name' ) )

		deepEqual( getState()['group-id'], {
			name: 'Group Name',
			id: 'group-id',
			members: {},
			exclusive: false
		} )
	} )

	it( 'should not remove default group', () => {
		const { getState, dispatch } = createStore( groups )
		dispatch( removeGroup( DEFAULT_GROUP_ID ) )
		ok( getState()[DEFAULT_GROUP_ID] )
	} )

	it( 'should set default group name', () => {
		const { getState, dispatch } = createStore( groups )
		dispatch( setDefaultGroupName( 'Everyone' ) )
		equal( getState()[DEFAULT_GROUP_ID].name, 'Everyone' )
	} )

	it( 'should remove a group', () => {
		const { getState, dispatch } = createStore( groups, { id: { id: 'id' } } )
		dispatch( removeGroup( 'id' ) )

		deepEqual( getState(), {} )
	} )

	it( 'should add group member', () => {
		const { getState, dispatch } = createStore( groups, { 'group-id': {
			members: {}
		} } )
		dispatch( addGroupMember( 'group-id', 'operator-id' ) )

		deepEqual( getState()['group-id'].members, { 'operator-id': true } )
	} )

	it( 'should remove group member', () => {
		const { getState, dispatch } = createStore( groups, {
			'group-id': { members: { 'operator-id': true } }
		} )
		dispatch( removeGroupMember( 'group-id', 'operator-id' ) )

		deepEqual( getState()['group-id'].members, {} )
	} )

	it( 'should add a group member via remote dispatch', () => {
		const { getState, dispatch } = createStore( groups )
		dispatch( remoteAction( updateOperatorMembership( 'group-id', true ) ) )
		deepEqual( getState()['group-id'].members, { 'remote-user': true } )
	} )

	it( 'should remove a group member via remote dispatch', () => {
		const { getState, dispatch } = createStore( groups, { 'group-id': { members: { 'remote-user': true } } } )
		dispatch( remoteAction( updateOperatorMembership( 'group-id', false ) ) )
		deepEqual( getState()['group-id'].members, {} )
	} )
} )
