import { deepEqual, ok } from 'assert'
import { createStore } from 'redux'

import groups from 'state/groups/reducer'
import {
	addGroup,
	removeGroup,
	addGroupMember,
	removeGroupMember
} from 'state/groups/actions'

import { DEFAULT_GROUP_NAME, DEFAULT_GROUP_ID } from 'state/groups/reducer'

describe( 'group reducer', () => {
	it( 'should have default state', () => {
		const { getState } = createStore( groups )
		deepEqual( getState(), { list: {
			[ DEFAULT_GROUP_ID ]: { name: DEFAULT_GROUP_NAME, id: DEFAULT_GROUP_ID }
		}, memberships: {} } )
	} )

	it( 'should add a group', () => {
		const { getState, dispatch } = createStore( groups );
		dispatch( addGroup( 'group-id', 'Group Name', 10 ) )

		deepEqual( getState().list['group-id'], {
			name: 'Group Name',
			id: 'group-id',
			priority: 10
		} )
	} )

	it( 'should remove a group', () => {
		const { getState, dispatch } = createStore( groups, { list: { id: { id: 'id' } } } )
		dispatch( removeGroup( 'id' ) )

		deepEqual( getState().list, {} )
	} )

	it( 'should add group member', () => {
		const { getState, dispatch } = createStore( groups )
		dispatch( addGroupMember( 'group-id', 'operator-id', 1 ) )

		deepEqual( getState().memberships['group-id'], { 'operator-id': 1 } )
	} )

	it( 'should remove group member', () => {
		const { getState, dispatch } = createStore( groups, { memberships: {
			'group-id': { 'operator-id': true }
		} } )
		dispatch( removeGroupMember( 'group-id', 'operator-id' ) )

		ok( getState().memberships, {} )
	} )
} )
