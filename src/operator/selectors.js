import {
	filter,
	compose,
	view,
	lensPath,
	sort,
	defaultTo,
	values
} from 'ramda'
import {
	STATUS_AVAILABLE
} from '../middlewares/socket-io'

// iterate through the identities, select STATUS_AVAILABLE and load > 0
const debug = require( 'debug' )( 'happychat:selector' );

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
