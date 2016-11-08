import { equal } from 'assert'
import { setOperatorCapacity } from 'operator/actions'
import reducer from 'operator/reducer';
import { createStore } from 'redux';
import { REMOTE_USER_KEY } from 'middlewares/socket-io/broadcast'
import { assoc } from 'ramda'

describe( 'Operator reducer', () => {
	it( 'should set operator capacity', () => {
		const store = createStore( reducer, { identities: { 'user-a': { capacity: 0 } } } )
		store.dispatch( assoc( REMOTE_USER_KEY, { id: 'user-a' }, setOperatorCapacity( 5 ) ) )
		equal( store.getState().identities[ 'user-a' ].capacity, 5 )
	} )

	it( 'should fail to set capacity with non-int type', () => {
		const store = createStore( reducer, { identities: { 'user-a': { capacity: 2 } } } )
		store.dispatch( assoc( REMOTE_USER_KEY, { id: 'user-a' }, setOperatorCapacity( 'a' ) ) )
		equal( store.getState().identities[ 'user-a' ].capacity, 2 )
	} )
} )
