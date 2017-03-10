import {
	compose,
	mapObjIndexed,
	values,
	filter,
	merge,
	objOf,
	tap
} from 'ramda'

import { getDefaultLocale } from './state/locales/selectors'
import { selectIdentities } from './state/operator/selectors'
import { setOperatorCapacity } from './state/operator/actions'
import { REMOTE_USER_KEY } from './state/middlewares/socket-io/broadcast'

const debug = require( 'debug' )( 'happychat-debug:upgrade-capacities' )

// When the system adds locale support, the existing capacities store in the
// operator identities will be added to the default locales.
export default ( store ) => {
	const state = store.getState()
	return () => {
		// get the default locale since it should now be configured
		const locale = getDefaultLocale( store.getState() )
		// get all user capacities
		// map all identies to their capacities
		compose(
			mapObjIndexed( ( operator ) => {
				store.dispatch( merge(
					setOperatorCapacity( locale, operator.capacity ),
					objOf( REMOTE_USER_KEY, operator )
				) )
			} ),
			tap( ops => debug( 'updating', ops ) ),
			filter( ( { capacity } ) => parseInt( capacity ) > 0 ),
			values,
			selectIdentities
		)( state )
	}
}
