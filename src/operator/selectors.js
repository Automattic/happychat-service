import get from 'lodash/get'
import reduce from 'lodash/reduce'
import {
	filter,
	compose,
	view,
	lensPath,
	sort,
	defaultTo,
	values,
	both
} from 'ramda'
import {
	STATUS_AVAILABLE
} from '../middlewares/socket-io'

const weight = ( { load, capacity } ) => ( capacity - load ) / capacity
const compare = ( a, b ) => {
	if ( a.weight === b.weight ) {
		if ( a.capacity === b.capacity ) {
			return 0;
		}
		return a.capacity > b.capacity ? -1 : 1
	}
	return a.weight > b.weight ? -1 : 1
}
export const getAvailableOperators = compose(
	sort( ( a, b ) => compare(
		{ weight: weight( a ), capacity: a.capacity },
		{ weight: weight( b ), capacity: b.capacity }
	) ),
	filter( ( { status, load, capacity } ) => {
		if ( status !== STATUS_AVAILABLE ) {
			return false;
		}
		return capacity - load > 0
	} ),
	values,
	defaultTo( {} ),
	view( lensPath( [ 'operators', 'identities' ] ) )
)

// Selectors
export const selectIdentities = ( { operators: { identities } } ) => values( identities )
export const selectSocketIdentity = ( { operators: { sockets, identities } }, socket ) => get(
	identities,
	get( sockets, socket.id )
)
export const selectUser = ( { operators: { identities } }, userId ) => get( identities, userId )
export const selectTotalCapacity = ( { operators: { identities } }, matchingStatus = STATUS_AVAILABLE ) => reduce( identities,
	( { load: totalLoad, capacity: totalCapacity }, { load, capacity, status } ) => ( {
		load: totalLoad + ( status === matchingStatus ? parseInt( load ) : 0 ),
		capacity: totalCapacity + ( status === matchingStatus ? parseInt( capacity ) : 0 )
	} ),
	{ load: 0, capacity: 0 }
)

export const getAvailableCapacity = state => {
	const { load, capacity } = selectTotalCapacity( state )
	return capacity - load
}

export const haveAvailableCapacity = state => getAvailableCapacity( state ) > 0

export const getSystemAcceptsCustomers = ( { operators: { system: { acceptsCustomers } } } ) => acceptsCustomers

export const isSystemAcceptingCustomers = both( haveAvailableCapacity, getSystemAcceptsCustomers )
