import { equal } from 'assert'
import { setOperatorCapacity } from 'operator/actions'
import reducer from 'operator/reducer';
import { createStore } from 'redux';
import { REMOTE_USER_KEY } from 'operator/canRemoteDispatch'
import { assoc } from 'ramda'

describe( 'Operator reducer', () => {
	it( 'should set operator capacity', () => {
		const store = createStore( reducer, { identities: { 'user-a': { capacity: 0 } } } )
		store.dispatch( assoc( REMOTE_USER_KEY, { id: 'user-a' }, setOperatorCapacity( 'user-a', 5 ) ) )
		equal( store.getState().identities[ 'user-a' ].capacity, 5 )
	} )
} )

