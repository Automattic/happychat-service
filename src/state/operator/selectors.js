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
	or,
	always,
	path,
	reduce,
	merge,
	map,
	pickBy,
	keys,
	flatten,
	mergeAll,
	toPairs
} from 'ramda'
import asString from '../as-string'
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
 * Comparison function for sorting operators by the requestingChat property
 *
 * @param {Operator} a First operator to compare
 * @param {Operator} b Second operator to compare
 * @return {Number} -1 if operator a is requesting a chat
 *                  0 if neither are requesting a chat
 *                  1 if operator b is requesting a chat
 */
const compareByRequestForChat = ( a, b ) => {
	// Neither operators are requesting a chat so don't alter their order
	if ( ! a.requestingChat && ! b.requestingChat ) {
		return 0;
	}

	// Only one of the operators is requesting a chat
	if ( a.requestingChat !== b.requestingChat ) {
		return a.requestingChat ? -1 : 1;
	}

	// Both are requesting a chat so lets use their status
	// To break the tie
	const statusComparison = compareOperatorByStatus( a, b );
	if ( statusComparison !== 0 ) {
		return statusComparison;
	}

	// They're still tied so lets try to break it using
	// their chat load
	const loadComparison = compareOperatorsByChatLoad( a, b );
	if ( loadComparison !== 0 ) {
		return loadComparison;
	}

	// still have a tie so let "a" win
	return -1;
}

/**
 * Compare function for sorting operators by their chat load
 *
 * @param {Operator} a First operator to compare
 * @param {Operator} b Second operator to compare
 * @return {Number} -1 if operator a is requesting a chat
 *                  0 if neither are requesting a chat
 *                  1 if operator b is requesting a chat
 */
const compareOperatorsByChatLoad = ( a, b ) => {
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

	if ( a.percentAvailable === b.percentAvailable ) {
		if ( a.totalAvailable === b.totalAvailable ) {
			return 0;
		}
		return a.totalAvailable > b.totalAvailable ? -1 : 1;
	}
	return a.percentAvailable > b.percentAvailable ? -1 : 1;
}

/**
 * Compare two operators using their status
 *
 * @param {Operator} a First operator to compare
 * @param {Operator} b Second operator to compare
 * @return {Number} -1 if operator a is available
 *                  0 if they have the same status
 *                  1 if operator b is available
 */
const compareOperatorByStatus = ( a, b ) => {
	if ( a.status === b.status ) {
		return 0;
	}

	// When comparing two operators, always prioritise the one whose
	// status is available over the one who is in reserve
	return a.status === STATUS_AVAILABLE ? -1 : 1;
}

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
	// Prioritize operators who are requesting a chat
	const requestForChatComparison = compareByRequestForChat( a, b );
	if ( requestForChatComparison !== 0 ) {
		return requestForChatComparison;
	}

	// When comparing two operators, always prioritise the one whose
	// status is available over the one who is in reserve
	const statusComparison = compareOperatorByStatus( a, b );
	if ( statusComparison !== 0 ) {
		return statusComparison;
	}

	return compareOperatorsByChatLoad( a, b );
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
		filter( ( { requestingChat, status, online, load, capacity, active, id } ) => {
			const isAvailable = status === STATUS_AVAILABLE || status === STATUS_RESERVE;
			if ( ! online || ! isAvailable ) {
				return false
			}
			if ( active !== true ) {
				return false
			}
			if ( ! isMemberOfGroup( id, group ) ) {
				return false
			}

			if ( requestingChat ) {
				return true;
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
export const getSocketOperator = ( socket, { operators: { sockets, identities } } ) => get(
	identities,
	get( sockets, socket.id )
)
export const selectUser = ( { operators: { identities } }, userId ) => get( identities, userId )
export const selectTotalCapacity = ( locale, groups, state ) =>
	reduce(
		( { load: totalLoad, capacity: totalCapacity }, { id, status, online } ) => {
			const { load, capacity, active } = getLocaleMembership( locale, id, state );
			return {
				load: totalLoad + parseInt( load, 10 ),
				capacity: totalCapacity + parseInt( capacity, 10 )
			};
		},
		{ load: 0, capacity: 0 },
		getAvailableOperators( locale, groups, state )
	);

export const hasOperatorRequestingChat = ( locale, groups, state ) => {
	const identities = get( state, 'operators.identities' );

	for( const operatorId in identities ) {
		const { requestingChat } = identities[ operatorId ];

		if ( requestingChat ) {
			const { active } = getLocaleMembership( locale, operatorId, state );
			return active && isMemberOfGroups( operatorId, groups );
		}
	}

	return false;
}

export const getAvailableCapacity = ( locale, groups, state ) => {
	const { load, capacity } = selectTotalCapacity( locale, groups, state )
	return capacity - load
}

export const haveAvailableCapacity = ( locale, groups, state ) => getAvailableCapacity( locale, groups, state ) > 0

export const getSystemAcceptsCustomers = ( { operators: { system: { acceptsCustomers } } } ) => acceptsCustomers

export const getOperatorOnline = ( id, state ) => path(
	[ 'operators', 'identities', asString( id ), 'online' ],
	state
)

export const getLocaleCapacities = state => compose(
	flatten,
	map( locale => compose(
		map( ( [ group, memberships ] ) => {
			const { load, capacity } = selectTotalCapacity( locale, [ memberships ], state )
			return { load, capacity, group, locale, operators: reduce( ( total, userId ) => {
				return getOperatorOnline( userId, state ) ? total + 1 : total
			}, 0, keys( memberships.members ) ) }
		} ),
		toPairs,
		getGroups
	)( state ) ),
	getSupportedLocales
)( state )

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

export const canAcceptChat = ( chatID, state ) => {
	if ( ! getSystemAcceptsCustomers( state  ) ) {
		return false;
	}

	const chatLocale = getChatLocale( chatID, state );
	const chatGroups = getChatGroups( chatID, state );

	return hasOperatorRequestingChat( chatLocale, chatGroups, state ) ||
		haveAvailableCapacity( chatLocale, chatGroups, state );
}

export const defaultLocaleIsAvailable = ( state ) => {
	const locale = getDefaultLocale( state )
	const group = getDefaultGroup( state )
	return haveAvailableCapacity( locale, [ group ], state )
}
