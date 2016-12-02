import { equal } from 'assert'
import { getAvailableCapacity, STATUS_AVAILABLE } from 'operator/selectors'

describe( 'Operator selectors', () => {
	it( 'should calculate available capacity', () => {
		// total of all operators online: true and status == STATUS_AVAILABLE
		equal(
			getAvailableCapacity( { operators: { identities: {
				a: { id: 'a', online: true, status: STATUS_AVAILABLE, load: 1, capacity: 4 },
				b: { id: 'b', online: true, status: STATUS_AVAILABLE, load: 2, capacity: 3 },
			} } } ),
			4
		)

		// exludes operators with online: false
		equal(
			getAvailableCapacity( { operators: { identities: {
				a: { id: 'a', online: false, status: STATUS_AVAILABLE, load: 1, capacity: 4 },
			} } } ),
			0
		)

		// exclude operators with status != STATUS_AVAILABLE
		equal(
			getAvailableCapacity( { operators: { identities: {
				a: { id: 'a', online: false, status: 'other', load: 1, capacity: 4 },
			} } } ),
			0
		)
	} )
} )
