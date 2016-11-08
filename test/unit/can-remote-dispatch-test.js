import { ok } from 'assert'
import canRemoteDispatch from 'operator/canRemoteDispatch'
import { setOperatorCapacity, setAcceptsCustomers } from 'operator/actions'

describe( 'Remote Dispatch', () => {
	it( 'can update system accept status', () => {
		ok( canRemoteDispatch( { action: setAcceptsCustomers( true ), user: true } ) )
	} )
	it( 'can set capacity for remote user', () => {
		ok( canRemoteDispatch( {
			action: setOperatorCapacity( 'a', 5 ),
			user: { id: 'a' }
		} ) )
	} )
	it( 'can not set capacity for other user', () => {
		ok( ! canRemoteDispatch( {
			action: setOperatorCapacity( 'a', 5 ),
			user: { id: 'b' }
		} ) )
	} )
} )
