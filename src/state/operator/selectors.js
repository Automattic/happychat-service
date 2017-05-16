import get from 'lodash/get'
import {
	filter,
	compose,
	contains,
	groupBy,
	sort,
	defaultTo,
	values,
	equals,
	ifElse,
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
	toPairs
} from 'ramda';
import asString from '../as-string';
import {
	getChatLocale,
	getChatGroups
} from '../chatlist/selectors'
import {
	getLocaleMembership,
	getSupportedLocales,
	getDefaultLocale
} from '../locales/selectors'
import { getGroups, makeLocaleGroupToken, getDefaultGroup } from '../groups/selectors'

import { STATUS_AVAILABLE, STATUS_RESERVE } from './constants';

const percentAvailable = ( { load, capacity } ) => ( capacity - defaultTo( 0, load ) ) / capacity
const totalAvailable = ( { load, capacity } ) => ( capacity - defaultTo( 0, load ) )

// This is the maximum number of chats a reserve operator can have before
// another reserve operator is brought in to handle further chats. When
// all reserve operators reach this limit, new chats will be balanced
// between reserve operators.
const RESERVE_MAX_CHATS = 2;

/**
/* Compare function for sorting operator priority. 
 *
 * The first operator in the resulting list should be the next one
 * to be assigned to a chat. This is used for balancing chat load
 * evenly across operators.
 *
 * @param {Operator} a First operator to compare
 * @param {Operator} b Second operator to compare
 * @return {Number} -1 if operator a should come first
 *                  0 if both operators are equal priority
 *                  1 if operator b should come first
 */
const compareOperatorPriority = ( a, b ) => {
	// When comparing two operators, always prioritise the one whose
	// status is available over the one who is in reserve
	if ( a.status === STATUS_RESERVE && b.status === STATUS_AVAILABLE ) {
		return 1;
	}
	if ( a.status === STATUS_AVAILABLE && b.status === STATUS_RESERVE ) {
		return -1;
	}

	// When comparing two operators in reserve, prioritise the one
	// already chatting to avoid disturbing the other.
	if ( a.status === STATUS_RESERVE && b.status === STATUS_RESERVE ) {
		const aLoad = a.load || 0;
		const bLoad = b.load || 0;
		if ( aLoad > 0 && aLoad < RESERVE_MAX_CHATS && bLoad === 0 ) {
			return -1;
		}

		if ( bLoad > 0 && bLoad < RESERVE_MAX_CHATS && aLoad === 0 ) {
			return 1;
		}
	}

	// Compare operators by their current chat load
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

/**
 * Returns a list of available operators for the given locale and groups,
 * sorted by priority where the first operator in the list should be
 * assigned the next chat.
 */
export const getAvailableOperators = ( locale, groups, state ) => compose(
	flatten,
	operators => map( group => compose(
		sort( compareOperatorPriority ),
		map( user => merge( user, {
			percentAvailable: percentAvailable( user ),
			totalAvailable: totalAvailable( user )
		} ) ),
		filter( ( { status, online, load, capacity, active, id } ) => {
			const isAvailable = contains( status, [ STATUS_AVAILABLE, STATUS_RESERVE ] );
			if ( ! online || ! isAvailable ) {
				return false;
			}
			if ( active !== true ) {
				return false;
			}
			if ( ! isMemberOfGroup( id, group ) ) {
				return false;
			}
			return capacity - defaultTo( 0, load ) > 0
		} )
	)( operators ), groups ),
	map( user => merge( user, getLocaleMembership( locale, user.id, state ) ) ),
	values,
	defaultTo( {} ),
	path( [ 'operators', 'identities' ] )
)( state );

/**
 * Takes a list of operators and groups them by their status
 */
export const groupOperatorsByStatus = ( operators ) => {
	const status = operator => operator.status;
	return groupBy( status, operators );
};

export const selectIdentities = path( [ 'operators', 'identities' ] )
export const getOperators = compose( values, selectIdentities )
export const selectSocketIdentity = ( { operators: { sockets, identities } }, socket ) => get(
	identities,
	get( sockets, socket.id )
)
export const selectUser = ( { operators: { identities } }, userId ) => get( identities, userId )

/**
 * Sums up the load and capacity for a locale for a given list of operators
 * @param {Array<Operator>} operators The list of operators to sum
 * @param {Array<Operator>} operators The locale to check
 * @param {State} state The global Redux state
 */
const sumOperatorLoads = ( operators, locale, state ) => {
	const reducer = ( accum, operator ) => {
		const { load, capacity } = getLocaleMembership( locale, operator.id, state );
		return {
			load: accum.load + parseInt( load, 10 ),
			capacity: accum.capacity + parseInt( capacity, 10 ),
		};
	};
	return reduce( reducer, { load: 0, capacity: 0 }, operators );
};

export const selectTotalCapacity = ( locale, groups, state ) => {
	const operators = getAvailableOperators( locale, groups, state );

	// Sum up the load and capacity for each status
	return sumOperatorLoads( operators, locale, state );
};

/**
 * Returns the current total capacity and load for each operator status. eg:
 *   {
 *     'available': { capacity: 20, load: 18 },
 * 	   'reserve': { capacity: 5, load: 0 }
 *   }
 */
export const selectCapacityByStatus = ( locale, groups, state ) => {
	const statuses = groupOperatorsByStatus(
		getAvailableOperators( locale, groups, state )
	);

	// Sum up the load and capacity for each status
	return map(
		operatorList => sumOperatorLoads( operatorList, locale, state ),
		statuses
	);
};

export const getAvailableCapacity = ( locale, groups, state ) => {
	const { load, capacity } = selectTotalCapacity( locale, groups, state );
	return capacity - load;
};

export const haveAvailableCapacity = ( locale, groups, state ) => getAvailableCapacity( locale, groups, state ) > 0

export const getSystemAcceptsCustomers = ( { operators: { system: { acceptsCustomers } } } ) => acceptsCustomers

export const getOperatorOnline = ( id, state ) => path(
	[ 'operators', 'identities', asString( id ), 'online' ],
	state
)

const countOnlineOperators = ( userIds, state ) => {
	return reduce(
		( total, userId ) => total + getOperatorOnline( userId, state ) ? 1 : 0,
		0,
		userIds
	);
};

export const getLocaleCapacities = state => {
	const mapLocale = map( locale => {
		const mapGroup = map( ( [ group, memberships ] ) => {
			const statuses = selectCapacityByStatus( locale, [ memberships ], state );

			return {
				statuses,
				group,
				locale,
				operators: countOnlineOperators( keys( memberships.members ), state )
			};
		} );

		return mapGroup( toPairs( getGroups( locale ) ) );
	} );

	return flatten( mapLocale( getSupportedLocales( state ) ) );
};

export const getAvailableLocales = state => ifElse(
	compose( not, getSystemAcceptsCustomers ),
	always( [] ),
	compose(
		flatten,
		map( locale => compose(
		map( group => makeLocaleGroupToken( locale, group ) ),
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

export const isOperatorStatusAvailable = ( id, state ) => equals(
	path(
		[ 'operators', 'identities', asString( id ), 'status' ],
		state
	),
	STATUS_AVAILABLE
)

export const isOperatorStatusReserve = ( id, state ) =>
	get( state, [ 'operators', 'identities', asString( id ), 'status' ] )
		=== STATUS_RESERVE;

export const isOperatorStatusAvailableOrInReserve = ( id, state ) =>
	isOperatorStatusAvailable( id, state ) || isOperatorStatusReserve( id, state );

export const isOperatorOnline = getOperatorOnline

export const isOperatorAcceptingChats = ( id, state ) =>
	isOperatorOnline( id, state ) && isOperatorStatusAvailableOrInReserve( id, state );

export const canAcceptChat = ( chatID, state ) => both(
	getSystemAcceptsCustomers,
	() => haveAvailableCapacity(
		getChatLocale( chatID, state ),
		getChatGroups( chatID, state ),
		state
	)
)( state )

export const defaultLocaleIsAvailable = ( state ) => {
	const locale = getDefaultLocale( state )
	const group = getDefaultGroup( state )
	return haveAvailableCapacity( locale, [ group ], state )
}
