import { equal } from 'assert'
import { getAvailableCapacity, STATUS_AVAILABLE } from 'operator/selectors'

describe( 'Operator selectors', () => {
	it( 'should calculate available capacity', () => {
		equal(
			getAvailableCapacity( { operators: { identities: {
				a: { id: 'a', online: true, status: STATUS_AVAILABLE, load: 1, capacity: 4 },
				b: { id: 'b', online: true, status: STATUS_AVAILABLE, load: 2, capacity: 3 },
			} } } ),
			4
		)

		equal(
			getAvailableCapacity( { operators: { identities: {
				a: { id: 'a', online: false, status: STATUS_AVAILABLE, load: 1, capacity: 4 },
			} } } ),
			0
		)

		equal(
			getAvailableCapacity( { operators: { identities: {
				a: { id: 'a', online: false, status: 'other', load: 1, capacity: 4 },
			} } } ),
			0
		)
	} )
} )
