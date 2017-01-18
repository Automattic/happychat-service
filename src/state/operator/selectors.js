import get from 'lodash/get'
import {
	filter,
	compose,
	view,
	lensPath,
	sort,
	defaultTo,
	values,
	equals,
	ifElse,
	whereEq,
	not,
	always,
	path,
	reduce,
	merge,
	map,
	when
} from 'ramda'
import asString from '../as-string'
import {
	getLocaleMembership,
	getSupportedLocales
} from '../locales/selectors'

export const STATUS_AVAILABLE = 'available';

const weight = ( { load, capacity } ) => ( capacity - defaultTo( 0, load ) ) / capacity
const compare = ( a, b ) => {
	if ( a.weight === b.weight ) {
		if ( a.capacity === b.capacity ) {
			return 0;
		}
		return a.capacity - a.load > b.capacity - b.load ? -1 : 1
	}
	return a.weight > b.weight ? -1 : 1
}

export const getAvailableOperators = ( locale, state ) => compose(
	sort( compare ),
	map( user => merge( user, { weight: weight( user ) } ) ),
	filter( ( { status, online, load, capacity, active } ) => {
		if ( !online || status !== STATUS_AVAILABLE ) {
			return false
		}
		if ( active !== true ) {
			return false
		}
		return capacity - defaultTo( 0, load ) > 0
	} ),
	map( user => merge( user, getLocaleMembership( locale, user.id, state ) ) ),
	values,
	defaultTo( {} ),
	view( lensPath( [ 'operators', 'identities' ] ) )
)( state )

// Selectors
export const selectIdentities = ( { operators: { identities } } ) => values( identities )
export const selectSocketIdentity = ( { operators: { sockets, identities } }, socket ) => get(
	identities,
	get( sockets, socket.id )
)
export const selectUser = ( { operators: { identities } }, userId ) => get( identities, userId )
export const selectTotalCapacity = ( locale, state ) => compose(
	reduce( ( { load: totalLoad, capacity: totalCapacity }, { id, status, online } ) =>
		when(
			whereEq( { status: STATUS_AVAILABLE, online: true } ),
			() => {
				const { load, capacity, active } = getLocaleMembership( locale, id, state )
				if ( !active ) {
					return { load: 0, capacity: 0 }
				}
				return {
					load: totalLoad + parseInt( load ),
					capacity: totalCapacity + parseInt( capacity )
				}
			}
		)( { status, online } ),
		{ load: 0, capacity: 0 }
	),
	values,
	path( [ 'operators', 'identities' ] )
)( state )

export const getAvailableCapacity = ( locale, state ) => {
	const { load, capacity } = selectTotalCapacity( locale, state )
	return capacity - load
}

export const haveAvailableCapacity = ( locale, state ) => getAvailableCapacity( locale, state ) > 0

export const getSystemAcceptsCustomers = ( { operators: { system: { acceptsCustomers } } } ) => acceptsCustomers

export const getAvailableLocales = state => ifElse(
	compose( not, getSystemAcceptsCustomers ),
	always( [] ),
	compose(
		filter( locale => getAvailableCapacity( locale, state ) > 0 ),
		getSupportedLocales
	)
)( state )

export const getOperatorIdentity = ( id, state ) => view(
	lensPath( [ 'operators', 'identities', asString( id ) ] ),
	state
)

export const getOperatorOnline = ( id, state ) => view(
	lensPath( [ 'operators', 'identities', asString( id ), 'online' ] ),
	state
)
export const isOperatorStatusAvailable = ( id, state ) => equals(
	view(
		lensPath( [ 'operators', 'identities', asString( id ), 'status' ] ),
		state
	),
	STATUS_AVAILABLE
)
export const isOperatorOnline = getOperatorOnline
export const isOperatorAcceptingChats = ( id, state ) => isOperatorOnline( id, state ) && isOperatorStatusAvailable( id, state )
