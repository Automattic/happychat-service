import get from 'lodash/get'
import {
	filter,
	compose,
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
	both,
	pickBy,
	keys,
	flatten,
	mergeAll,
} from 'ramda'
import asString from '../as-string'
import {
	getChatLocale,
	getChatGroups
} from '../chatlist/selectors'
import {
	getLocaleMembership,
	getSupportedLocales
} from '../locales/selectors'
import { getGroups } from '../groups/selectors'

export const STATUS_AVAILABLE = 'available';

const percentAvailable = ( { load, capacity } ) => ( capacity - defaultTo( 0, load ) ) / capacity
const totalAvailable = ( { load, capacity } ) => ( capacity - defaultTo( 0, load ) )
const compare = ( a, b ) => {
	if ( a.percentAvailable === b.percentAvailable ) {
		if ( a.totalAvailable === b.totalAvailable ) {
			return 0;
		}
		return a.totalAvailable > b.totalAvailable ? -1 : 1
	}
	return a.percentAvailable > b.percentAvailable ? -1 : 1
}

const isMemberOfGroup = ( userID, group ) => compose(
	defaultTo( false ),
	path( [ 'members', asString( userID ) ] ),
)( group )

const isMemberOfGroups = ( userID, groups ) => compose(
	defaultTo( false ),
	path( [ 'members', asString( userID ) ] ),
	mergeAll
)( groups )

export const getAvailableOperators = ( locale, groups, state ) => compose(
	flatten,
	operators => map( group => compose(
		sort( compare ),
		map( user => merge( user, {
			percentAvailable: percentAvailable( user ),
			totalAvailable: totalAvailable( user )
		} ) ),
		filter( ( { status, online, load, capacity, active, id } ) => {
			if ( !online || status !== STATUS_AVAILABLE ) {
				return false
			}
			if ( active !== true ) {
				return false
			}
			if ( ! isMemberOfGroup( id, group ) ) {
				return false
			}
			return capacity - defaultTo( 0, load ) > 0
		} )
	)( operators ), groups ),
	map( user => merge( user, getLocaleMembership( locale, user.id, state ) ) ),
	values,
	defaultTo( {} ),
	path( [ 'operators', 'identities' ] )
)( state )

export const selectIdentities = path( [ 'operators', 'identities' ] )
export const getOperators = compose( values, selectIdentities )
export const selectSocketIdentity = ( { operators: { sockets, identities } }, socket ) => get(
	identities,
	get( sockets, socket.id )
)
export const selectUser = ( { operators: { identities } }, userId ) => get( identities, userId )
export const selectTotalCapacity = ( locale, groups, state ) => compose(
	reduce( ( { load: totalLoad, capacity: totalCapacity }, { id, status, online } ) =>
		ifElse(
			whereEq( { status: STATUS_AVAILABLE, online: true } ),
			() => {
				const { load, capacity, active } = getLocaleMembership( locale, id, state )
				if ( ! active || ! isMemberOfGroups( id, groups ) ) {
					return { load: totalLoad, capacity: totalCapacity }
				}
				return {
					load: totalLoad + parseInt( load ),
					capacity: totalCapacity + parseInt( capacity )
				}
			},
			() => ( { load: totalLoad, capacity: totalCapacity } )
		)( { status, online } ),
		{ load: 0, capacity: 0 }
	),
	values,
	path( [ 'operators', 'identities' ] )
)( state )

export const getAvailableCapacity = ( locale, groups, state ) => {
	const { load, capacity } = selectTotalCapacity( locale, groups, state )
	return capacity - load
}

export const haveAvailableCapacity = ( locale, groups, state ) => getAvailableCapacity( locale, groups, state ) > 0

export const getSystemAcceptsCustomers = ( { operators: { system: { acceptsCustomers } } } ) => acceptsCustomers

export const getAvailableLocales = state => ifElse(
	compose( not, getSystemAcceptsCustomers ),
	always( [] ),
	compose(
		flatten,
		map( locale => compose(
				map( group => `${ locale }-${ group }` ),
				keys,
				pickBy( group => haveAvailableCapacity( locale, [ group ], state ) ),
				getGroups
		)( state ) ),
		getSupportedLocales
	)
)( state )

export const getOperatorIdentity = ( id, state ) => path(
	[ 'operators', 'identities', asString( id ) ],
	state
)

export const getOperatorOnline = ( id, state ) => path(
	[ 'operators', 'identities', asString( id ), 'online' ],
	state
)

export const isOperatorStatusAvailable = ( id, state ) => equals(
	path(
		[ 'operators', 'identities', asString( id ), 'status' ],
		state
	),
	STATUS_AVAILABLE
)

export const isOperatorOnline = getOperatorOnline

export const isOperatorAcceptingChats = ( id, state ) =>
	isOperatorOnline( id, state ) && isOperatorStatusAvailable( id, state )

export const canAcceptChat = ( chatID, state ) => both(
	getSystemAcceptsCustomers,
	() => haveAvailableCapacity(
		getChatLocale( chatID, state ),
		getChatGroups( chatID, state ),
		state
	)
)( state )
