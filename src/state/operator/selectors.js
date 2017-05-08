import { get, find } from 'lodash';
import {
	filter,
	compose,
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

const percentAvailable = ( { load, capacity } ) => capacity > 0 ? ( capacity - defaultTo( 0, load ) ) / capacity : 0
const totalAvailable = ( { load, capacity } ) => ( capacity - defaultTo( 0, load ) )

// This is the maximum number of chats a reserve operator can have before
// another reserve operator is brought in to handle further chats. When
// all reserve operators reach this limit, new chats will be balanced
// between reserve operators.
const RESERVE_MAX_CHATS = 2;

/* Compare function for sorting operator priority.
 *
 * The first operator in the resulting list should be the next one
 * to be assigned to a chat. This is used for balancing chat load
 * evenly across operators.
 *
 * @param {Operator} a First operator to compare
 * @param {Operator} b Second operator to compare
 * @return {Number} -1 if operator a is requesting a chat
 *                  0 if neither are requesting a chat
 *                  1 if operator b is requesting a chat
 */
const compareByRequestForChat = ( a, b ) => {
	// using ! here incase one is undefined and the other is false
	if ( ! a.requestingChat === ! b.requestingChat ) {
		return 0;
	}

	return a.requestingChat ? -1 : 1;
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
	// Order matters here as the first non zero comparison result will be used.
	const prioritizedComparisons = [
		compareByRequestForChat,
		compareOperatorByStatus,
		compareOperatorsByChatLoad,
	];

	let result = 0;

	// get the first comparison thats truthy.
	// Take advantage of -1 and 1 being truthy while 0 is falsy.
	find( prioritizedComparisons, compare => result = compare( a, b ) );

	return result;
}

/**
 * Checks if operator is a member in a group
 *
 * @param { String } userID - id of operator to check
 * @param { Object } group - group record from the group reducer state
 * @returns { boolean } true if the user is a member of the group
 */
const isMemberOfGroup = ( userID, group ) => compose(
	defaultTo( false ),
	path( [ 'members', asString( userID ) ] ),
)( group )

/**
 * Checks if an operator is a member of 1 or more groups
 *
 * @param { String } userID - id of the operator
 * @param { Object[] } groups - list of group records from group reducer
 * @returns { boolean } true if the operator is a member of any of the groups
 */
const isMemberOfGroups = ( userID, groups ) => compose(
	defaultTo( false ),
	path( [ 'members', asString( userID ) ] ),
	mergeAll
)( groups )

/**
 * Returns a list of available operators for the given locale and groups,
 * sorted by priority where the first operator in the list should be
 * assigned the next chat.
 *
 * @param { String } locale - locale code for the chat
 * @param { Object[] } groups - list of groups for the chat
 * @param { Object } state - redux global state
 * @returns { Object[] } sorted list of operators that can be assigned
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

/**
 *
 * @function
 * @param { Object } state - global redux state
 * @returns { Object } all operator indentities mapped by operator id
 */
export const selectIdentities = path( [ 'operators', 'identities' ] )

/**
 * @function
 * @param { Object } state - global redux state
 * @returns { Object[] } list of operator identities
 */
export const getOperators = compose( values, selectIdentities )

/**
 * Get the operator identity associated with a Socket.IO socket
 *
 * @param { Object } socket - Socket.IO socket instance
 * @param { Object } state - redux state
 * @returns { Object } operator identity
 */
export const getSocketOperator = ( socket, { operators: { sockets, identities } } ) => get(
	identities,
	get( sockets, socket.id )
)

/**
 * Get the identity of the given userId
 * @param { Object } state - global redux state
 * @param { String } userId - id of the identity to get
 * @returns { Object } operator identity
 */
export const selectUser = ( { operators: { identities } }, userId ) => get( identities, userId )

/**
 * @typedef Capacity
 * @property { number } load - number of open chats assigned
 * @property { number } capacity - number of total chats that can be assigned
 */

/**
 * @param { String } locale - locale code
 * @param { Object[] } groups - list of groups in locale
 * @param { Object } state - global redux state
 * @returns { Capacity }
 */
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

export const isAnyOperatorRequestingChat = ( state ) => {
	const identities = get( state, 'operators.identities' );

	for( const operatorId in identities ) {
		const { requestingChat } = identities[ operatorId ];
		if ( requestingChat ) {
			return true;
		}
	}

	return false;
}

export const hasOperatorRequestingChat = ( locale, groups, state ) => {
	const identities = get( state, 'operators.identities' );

	for( const operatorId in identities ) {
		const { requestingChat } = identities[ operatorId ];

		if ( requestingChat ) {
			const { active } = getLocaleMembership( locale, operatorId, state );
			return active &&
				isMemberOfGroups( operatorId, groups ) &&
				isOperatorAcceptingChats( operatorId, state );
		}
	}

	return false;
}

/**
 * Total number of chats that can still be assigned in the locale with
 * the given groups.
 *
 * @param { String } locale - locale code
 * @param { Object[] } groups - list of groups from groups reducer
 * @param { Object } state - global redux state
 * @returns { number } total available chats
 */
export const getAvailableCapacity = ( locale, groups, state ) => {
	const { load, capacity } = selectTotalCapacity( locale, groups, state )
	return capacity - load
}

/**
 * @param { String } locale - locale code
 * @param { Object[] } groups - list of groups from groups reducer
 * @param { Object } state - global redux state
 * @returns { boolean } available chat capacity is greater than 0
 */
export const haveAvailableCapacity = ( locale, groups, state ) => getAvailableCapacity( locale, groups, state ) > 0

/**
 * @param { Object } state - global redux state
 * @returns { boolean } true if new chats can be accepted
 */
export const getSystemAcceptsCustomers = ( { operators: { system: { acceptsCustomers } } } ) => acceptsCustomers

/**
 * @param { String } id - operator id
 * @param { Object } state - global redux state
 * @returns { boolean } true if operator has a connected client
 */
export const getOperatorOnline = ( id, state ) => path(
	[ 'operators', 'identities', asString( id ), 'online' ],
	state
)
export const isOperatorOnline = getOperatorOnline

/**
 * @param { Object } state - global redux state
 * @returns { Object[] } list of locale groups and their capacities
 */
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

/**
 * Gets a list of locales that have operators than can accept chats.
 *
 * @param { Object } state - global redux state
 * @returns { String[] } list of locale group codes that can accept chats
 */
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

/**
 * @param { String } id - operator id
 * @param { Object } state - global redux state
 * @returns { Object } operator indentity
 */
export const getOperatorIdentity = ( id, state ) => path(
	[ 'operators', 'identities', asString( id ) ],
	state
)

/**
 * @param { String } id - operator id
 * @param { Object } state - global redux state
 * @returns { String } operator's status
 */
export const getOperatorStatus = ( id, state ) => path(
	[ 'operators', 'identities', asString( id ), 'status' ],
	state
)

/**
 * @param { String } id - operator id
 * @param { Object } state - global redux state
 * @returns { boolean } true if user status is STATUS_AVAILABLE
 */
export const isOperatorStatusAvailable = ( id, state ) => equals(
	getOperatorStatus( id, state ),
	STATUS_AVAILABLE
)

/**
 * @param { String } id - operator id
 * @param { Object } state - global redux state
 * @returns { boolean } true if user status is STATUS_RESERVE
 */
export const isOperatorStatusReserve = ( id, state ) =>
	getOperatorStatus( id, state ) === STATUS_RESERVE;

/**
 * @param { String } id - operator id
 * @param { Object } state - global redux state
 * @returns { boolean } true if user status is STATUS_RESERVE
 */
export const isOperatorStatusAvailableOrInReserve = ( id, state ) =>
	isOperatorStatusAvailable( id, state ) || isOperatorStatusReserve( id, state );

/**
 * @param { String } id - operator id
 * @param { Object } state - global redux state
 * @param { boolean } true if user can accept a chat
 */
export const isOperatorAcceptingChats = ( id, state ) =>
	isOperatorOnline( id, state ) && isOperatorStatusAvailableOrInReserve( id, state );

/**
 * @param { String } chatID - id of chat to check
 * @param { Object } state - global redux state
 * @returns { boolean } true if chat can be accepted
 */
export const canAcceptChat = ( chatID, state ) => {
	if ( ! getSystemAcceptsCustomers( state  ) ) {
		return false;
	}

	const chatLocale = getChatLocale( chatID, state );
	const chatGroups = getChatGroups( chatID, state );

	return hasOperatorRequestingChat( chatLocale, chatGroups, state ) ||
		haveAvailableCapacity( chatLocale, chatGroups, state );
}

/**
 * @param { Object } state - global redux state
 * @returns { boolean } true of the default locale can accept a chat
 */
export const defaultLocaleIsAvailable = ( state ) => {
	const locale = getDefaultLocale( state )
	const group = getDefaultGroup( state )
	return haveAvailableCapacity( locale, [ group ], state )
}
