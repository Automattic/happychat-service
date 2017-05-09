import {
	filter,
	compose,
	values,
	whereEq,
	map,
	equals,
	both,
	defaultTo,
	isEmpty,
	head,
	not,
	prop,
	when,
	flip,
	contains,
	always,
	groupBy,
	mapObjIndexed,
	subtract,
	lt,
	either,
	isNil,
	append,
	find,
	identity,
	toLower,
	keys,
	anyPass,
} from 'ramda';
import {
	statusView,
	chatView,
	operatorView,
	membersView,
	localeView,
	timestampView,
	groupsView,
	STATUS_ABANDONED,
	STATUS_MISSED,
	STATUS_NEW,
	STATUS_PENDING,
	STATUS_ASSIGNING,
	STATUS_CLOSED,
	STATUS_ASSIGNED,
	STATUS_CUSTOMER_DISCONNECT
} from './reducer';
import {
	getDefaultLocale,
	getSupportedLocales
} from '../locales/selectors';
import {
	getGroup
} from '../groups/selectors';
import {
	DEFAULT_GROUP_ID
} from '../groups/reducer';
import {
	getOperatorIdentity
} from '../operator/selectors';

export const selectChatlist = prop( 'chatlist' );

const selectChat = id => compose(
	defaultTo( [] ),
	prop( id ),
	selectChatlist
);
const mapToChat = map( chatView );
const mapToMembers = map( membersView );
const matchingStatus = status => filter( compose( equals( status ), statusView ) );
const matchingStatuses = statuses => filter(
	compose(
		anyPass( map( equals, statuses ) ),
		statusView
	)
);

/**
 * Removes closed chats from a list of chat records
 * @function
 * @param { Array[] } chatlist - array of chat records
 * @returns { Array[] } chatlist with chats with STATUS_CLOSED removed
 */
const filterClosed = filter( compose( not, equals( STATUS_CLOSED ), statusView ) );

/**
 * Selects all chats assigned/associated with given operator id
 *
 * @param { string } operatorID - chats assigned to this operator
 * @param { Object } state - redux state
 * @returns { Object[] } an array of chats assigned to the operator
 */
export const getChatsForOperator = ( operatorID, state ) => compose(
	// take the 2nd item (the chat)
	mapToChat,
	// filter the values of chat
	filter( compose(
		// compare operator.id to operator_id and match when equal
		whereEq( { id: operatorID } ),
		defaultTo( {} ),
		// take the 3rd item in chat row [STATUS, CHAT, OPERATOR]
		operatorView
	) ),
	// get the values of chat
	values,
	selectChatlist
)( state );

/**
 * Selects all open chats for the given operator_id
 *
 * @param { string } operatorID - chats assigned no this operator
 * @param { Object } state - redux state tree
 * @returns { Object[] } list of open chats assigned to the operator
 */
export const getOpenChatsForOperator = ( operatorID, state ) => compose(
	// take the 2nd item (the chat)
	mapToChat,
	// filter the values of chat
	filter( both(
		compose(
			// compare operator.id to operator_id and match when equal
			whereEq( { id: operatorID } ),
			defaultTo( {} ),
			// take the 3rd item in chat row [STATUS, CHAT, OPERATOR]
			operatorView
		),
		compose(
			not,
			equals( STATUS_CLOSED ),
			statusView
		)
	) ),
	// get the values of chat
	values,
	selectChatlist
)( state );

/**
 * Selects the indenities for operators than are in a given chat.
 *
 * @param { string } chatID - id of the chat
 * @param { Object } state - redux reducer state
 * @returns { Object[] } list of operator identites that have joined the chat
 */
export const getChatMemberIdentities = ( chatID, state ) => compose(
	map( id => getOperatorIdentity( id, state ) ),
	keys,
	membersView,
	selectChat( chatID )
)( state );

/**
 * Gets locale information for the given localeCode (e.g. "en"). If no matching
 * locale exists it returns the default locale for the system.
 *
 * @param { String } localeCode - the identifiter for the locale: e.g "en" "bt-BR"
 * @param { Object } state - redux state
 * @returns { Object } locale for the given localeCode
 */
const getLocale = ( localeCode, state ) => {
	const systemLocale = getDefaultLocale( state );
	const supportedLocales = getSupportedLocales( state );
	return compose(
		defaultTo( systemLocale ),
		find( compose(
			equals( compose( toLower, defaultTo( systemLocale ) )( localeCode ) ),
			toLower
		) )
	)( supportedLocales );
};

/**
 * Returns a map of operator ids in open chats grouped by locales. Used to determine
 * the total load of the system.
 *
 * @param { Object } state redux state
 * @returns { Object } map of chats operator ids grouped by locales
 */
export const getOpenChatMembers = state => compose(
	mapObjIndexed( mapToMembers ),
	groupBy( compose(
		flip( getLocale )( state ),
		localeView,
	) ),
	filterClosed,
	values,
	selectChatlist
)( state );

/**
 * Selects all chats in the chatlist.
 *
 * @function
 * @param { Object } state - redux state
 * @returns { Object[] } list of chats
 */
export const getAllChats = compose( mapToChat, values, selectChatlist );

/**
 * Alias of getAllChats
 * @function
 * @param { Object } state - redux state
 * @returns { Object[] } list of chats
 */
export const getChats = getAllChats;

/**
 * Selects all chats with a given chat status
 *
 * @param { string } status - status to match
 * @param { Object } state - redux state
 * @returns { Object[] } list of chats matching the state
 */
export const getChatsWithStatus = ( status, state ) => compose(
	mapToChat,
	matchingStatus( status ),
	values,
	selectChatlist
)( state );

export const getChatsWithStatuses = ( statuses, state ) => compose(
	mapToChat,
	matchingStatuses( statuses ),
	values,
	selectChatlist
)( state );

/**
 * Gets a list all chats woth STATUS_NEW. These are chats where the customer has
 * not sent a message so the chat has not been assigned to anyone.
 *
 * @param { Object } state redux state
 * @returns { Object[] } list of chats that have STATUS_NEW
 */
export const getAllNewChats = state => getChatsWithStatus( STATUS_NEW, state );

/**
 * Gets a list of all chats with STATUS_MISSED. These are chats that needed to be
 * assigned to an operator but failed to get one.
 *
 * @param { Object } state redux state
 * @returns { Object[] } list of chats that have STATUS_MISSED
 */
export const getAllMissedChats = state => getChatsWithStatus( STATUS_MISSED, state );

/**
 * Alias of getAllMissedChats
 * @function
 * @param { Object } state redux state
 * @returns { Object[] } list of chats that have STATUS_MISSED
 */
export const getMissedChats = getAllMissedChats;
/**
 * Gets a list of all chats that are assigned to operator of `id` and have status
 * of STATUS_ABANDONED.
 *
 * When an operator disconnects while assigned to chats, the chats are marked as
 * abandoned.
 *
 * @param { String } id operator id
 * @param { Object } state redux state
 * @returns { Object[] } list of matching chats
 */
export const getOperatorAbandonedChats = ( id, state ) => compose(
	mapToChat,
	filter( both(
		compose( whereEq( { id } ), defaultTo( {} ), operatorView ),
		compose( equals( STATUS_ABANDONED ), statusView )
	) ),
	values,
	selectChatlist
)( state );

/**
 * Gets a list of all chats with status of STATUS_ABANDONED
 *
 * @param { Object } state redux state
 * @returns { Object[] } list of abandoned chats
 */
export const getAbandonedChats = ( state ) => getChatsWithStatus( STATUS_ABANDONED, state );

/**
 * Gets the operator assigned to the requested chat
 *
 * @param { string } chatID - id of the chat
 * @param { Object } state - redux state
 * @returns { Object } operator identity assigned to chat
 */
export const getChatOperator = ( chatID, state ) => compose(
	operatorView,
	selectChat( chatID )
)( state );

/**
 * Gets chat details for the given chatID
 *
 * @param { string } chatID - id requested
 * @param { Object } state - redux state
 * @returns { Object } chat details
 */
export const getChat = ( chatID, state ) => compose(
	chatView,
	selectChat( chatID ),
)( state );

/**
 * Gets the status for the chatID. If chatID is not in the chat list returns
 * STATUS_NEW.
 *
 * @param { String } chatID - chat id to look for
 * @param { Object } state - redux state
 * @returns { String } chat status
 */
export const getChatStatus = ( chatID, state ) => compose(
	defaultTo( STATUS_NEW ),
	statusView,
	selectChat( chatID )
)( state );

/**
 * @param { String } chatID - id of chat to check
 * @param { Object } state redux state
 * @returns { Boolean } true if chat has status of STATUS_NEW
 */
export const isChatStatusNew = ( chatID, state ) => equals(
	STATUS_NEW, getChatStatus( chatID, state )
);

/**
 * @param { String } chatID - id of chat to check
 * @param { Object } state redux state
 * @returns { Boolean } true if chat has status of STATUS_CLOSED
 */
export const isChatStatusClosed = ( chatID, state ) => equals(
	STATUS_CLOSED, getChatStatus( chatID, state )
);

/**
 * @param { String } chatID - id of chat to check
 * @param { Object } state redux state
 * @returns { Boolean } true if chat has status of STATUS_ASSIGNED
 */
export const isChatStatusAssigned = ( chatID, state ) => equals(
	STATUS_ASSIGNED, getChatStatus( chatID, state )
);

/**
 * @param { String } chatID - id of chat to check
 * @param { Object } state redux state
 * @returns { Boolean } true if chat has status of STATUS_ASSIGNED
 */

export const isChatStatusCustomerDisconnect = ( chatID, state ) =>
	STATUS_CUSTOMER_DISCONNECT === getChatStatus( chatID, state );

/**
 * Checks if there are any chats  with the given status.
 *
 * @param { String } status - chat status to find
 * @param { Object } state - redux state
 * @returns { Boolean } true if any chat's status matches `status`
 */
const haveChatWithStatus = ( status, state ) => ! isEmpty(
	getChatsWithStatus( status, state )
);

/**
 * @param { Object } state redux state
 * @returns { Boolean } true if a chat exists with status of STATUS_ASSIGNING
 */
export const isAssigningChat = state => haveChatWithStatus( STATUS_ASSIGNING, state );

/**
 * Get the locale assigned to the chat. If no locale, use the system default.
 * If the locale is not explicity supported by the system, use the system default.
 *
 * @param { String } chatID - chat id
 * @param { Object } state - redux state
 * @returns { Object } locale record for requested chat
 */
export const getChatLocale = ( chatID, state ) => compose(
	flip( getLocale )( state ),
	localeView,
	selectChat( chatID )
)( state );

/**
 * Gets list of groups this chat is assigned to.
 *
 * @param { String } chatID - chat id
 * @param { Object } state - redux state
 * @returns { Object[] } list of groups this chat is associated with
 */
export const getChatGroups = ( chatID, state ) => compose(
	either(
		// if a non exclusive group is found select only an array of that single
		// group
		compose(
			when( compose( not, isNil ), flip( append )( [] ) ),
			find( whereEq( { exclusive: true } ) )
		),
		// if no exclusive groups were found, pass the list as is
		identity
	),
	// map the group ids te their group dato using the group selector
	map( id => getGroup( id, state ) ),
	// if the list of group ids does not have the default group, add it
	when( compose( not, contains( DEFAULT_GROUP_ID ) ), append( DEFAULT_GROUP_ID ) ),
	// when the list of groups is empty, return a list of the default group id
	when( either( isEmpty, isNil ), always( [ DEFAULT_GROUP_ID ] ) ),
	// select the group ids from the record
	groupsView,
	// get the chat record from state
	selectChat( chatID ),
)( state );

/**
 * Filter to match chats that are considered pending.
 *
 * @function
 * @param { Object[] } chats - list of chatlist records
 * @returns { Object[] } chat recordes that are considered pending
 */
const findPending = filter( compose(
	equals( STATUS_PENDING ),
	statusView
) );

/**
 * Gets a list of chatlist records that are considered pending.
 *
 * @function
 * @param { Object } state - redux state
 * @returns { Object[] } list of chat records that are pending assignment
 */
const getAssignableChats = compose(
	findPending,
	values,
	selectChatlist
);

/**
 * Gets a list of chats that are considered pending.
 * @function
 * @param { Object } state - redux state
 * @returns { Object } list of chats that are considered pending
 */
export const getAllAssignableChats = compose(
	mapToChat,
	findPending,
	values,
	selectChatlist
);

/**
 * @function
 * @param { Object } state - redux state
 * @returns { Boolean } true if any chat is needing assignment
 */
export const haveAssignableChat = compose(
	not,
	isEmpty,
	getAssignableChats
);

/**
 * @function
 * @param { Object } state - redux state
 * @returns { Object } chat that needs next assignment
 */
export const getNextAssignableChat = compose(
	chatView,
	head,
	getAssignableChats
);

/**
 * Get chats that have been closed for amount of time in seconds.
 *
 * @param { number } ageInSeconds - minimum number of seconds old a chat must be
 * @param { Object } state - redux state
 * @returns { Object[] } list of chats that are closed and are older than ageInSeconds
 */
export const getClosedChatsOlderThan = ( ageInSeconds, state ) => compose(
	mapToChat,
	filter( both(
		compose( equals( STATUS_CLOSED ), statusView ),
		compose( lt( ageInSeconds * 1000 ), subtract( Date.now() ), timestampView )
	) ),
	values,
	selectChatlist
)( state );
