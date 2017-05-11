import { equal, deepEqual } from 'assert'
import { merge } from 'ramda'

import upgradeCapacities from 'upgrade-capacities'
import { setOperatorCapacity } from 'state/operator/actions'
import { REMOTE_USER_KEY } from 'state/middlewares/socket-io/broadcast'

describe( 'Upgrade capacities to locales', () => {
	it( 'should update default locale capacities', () => {
		const actions = []
		upgradeCapacities( {
			getState: () => ( {
				locales: { defaultLocale: 'xx' },
				operators: { identities: {
					a: { id: 'a', capacity: 1 },
					b: { id: 'b', capacity: 2 },
					c: { id: 'c', capacity: 0 },
					d: { id: 'd' }
				} }
			} ),
			dispatch: action => actions.push( action )
		} )()

		deepEqual( actions, [
			merge( setOperatorCapacity( 'xx', 1 ), { [REMOTE_USER_KEY]: { id: 'a', capacity: 1 } } ),
			merge( setOperatorCapacity( 'xx', 2 ), { [REMOTE_USER_KEY]: { id: 'b', capacity: 2 } } ),
		] )
	} )
} )
