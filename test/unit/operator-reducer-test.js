import { deepEqual, equal } from 'assert'
import { setOperatorCapacity, setOperatorStatus } from 'state/operator/actions'
import reducer from 'state/operator/reducer';
import { createStore } from 'redux';
import { REMOTE_USER_KEY } from 'broadcast'
import { assoc } from 'ramda'
import { serializeAction } from 'state'

describe( 'Operator reducer', () => {
	it( 'should set operator status', () => {
		const store = createStore( reducer, { identities: { 'user-a': { status: 'other' } } } )
		store.dispatch( assoc( REMOTE_USER_KEY, { id: 'user-a' }, setOperatorStatus( 'known' ) ) )
		equal( store.getState().identities[ 'user-a' ].status, 'known' )
	} )

	it( 'should fail to set capacity with non-int type', () => {
		const store = createStore( reducer, { identities: { 'user-a': { capacity: 2 } } } )
		store.dispatch( assoc( REMOTE_USER_KEY, { id: 'user-a' }, setOperatorCapacity( 'a' ) ) )
		equal( store.getState().identities[ 'user-a' ].capacity, 2 )
	} )

	it( 'should update user', () => {
		const store = createStore( reducer )
		store.dispatch( { type: 'UPDATE_IDENTITY', user: { id: 1, name: 'hi' }, socket: {} } )
		deepEqual( store.getState().identities, { 1: { id: 1, name: 'hi', online: true } } )
	} )

	it( 'should remove sockets on serialize', () => {
		const store = createStore( reducer, {
			sockets: { 'socket-a': 'operator-a' },
			user_sockets: { 'socket-b': 'user-b' }
		} )
		store.dispatch( serializeAction() );
		deepEqual( store.getState().sockets, {} );
		deepEqual( store.getState().user_sockets, {} );
	} )
} )
