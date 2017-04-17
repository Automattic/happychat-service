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
	keys
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
	STATUS_ASSIGNED
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

const getLocale = ( locale, state ) => {
	const systemLocale = getDefaultLocale( state );
	const supportedLocales = getSupportedLocales( state );
	return compose(
		defaultTo( systemLocale ),
		find( compose(
			equals( compose( toLower, defaultTo( systemLocale ) )( locale ) ),
			toLower
		) )
	)( supportedLocales );
};

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

export const getAllChats = compose( mapToChat, values, selectChatlist );
export const getChatsWithStatus = ( status, state ) => compose(
	mapToChat,
	matchingStatus( status ),
	values,
	selectChatlist
)( state );

export const getAllNewChats = state => getChatsWithStatus( STATUS_NEW, state );
export const getAllMissedChats = state => getChatsWithStatus( STATUS_MISSED, state );

export const getOperatorAbandonedChats = ( id, state ) => compose(
	mapToChat,
	filter( both(
		compose( whereEq( { id } ), defaultTo( {} ), operatorView ),
		compose( equals( STATUS_ABANDONED ), statusView )
	) ),
	values,
	selectChatlist
)( state );

export const getAbandonedChats = ( state ) => getChatsWithStatus( STATUS_ABANDONED, state );
export const getMissedChats = ( state ) => getChatsWithStatus( STATUS_MISSED, state );

export const getChatOperator = ( chatID, state ) => compose(
	operatorView,
	selectChat( chatID )
)( state );

export const getChat = ( chatID, state ) => compose(
	chatView,
	selectChat( chatID ),
)( state );

export const getChats = state => compose(
	mapToChat,
	values,
	selectChatlist
)( state );

export const getChatStatus = ( chatID, state ) => compose(
	defaultTo( STATUS_NEW ),
	statusView,
	selectChat( chatID )
)( state );

export const isChatStatusNew = ( chatID, state ) => equals(
	STATUS_NEW, getChatStatus( chatID, state )
);

export const isChatStatusClosed = ( chatID, state ) => equals(
	STATUS_CLOSED, getChatStatus( chatID, state )
);

export const isChatStatusAssigned = ( chatID, state ) => equals(
	STATUS_ASSIGNED, getChatStatus( chatID, state )
);

const haveChatWithStatus = ( status, state ) => ! isEmpty(
	getChatsWithStatus( status, state )
);

export const isAssigningChat = state => haveChatWithStatus( STATUS_ASSIGNING, state );

// Get the locale assigned to the chat. If no locale, use the system default
// If the locale is not explicity supported by the system, use the system default
export const getChatLocale = ( chatID, state ) => compose(
	flip( getLocale )( state ),
	localeView,
	selectChat( chatID )
)( state );

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

const findPending = filter( compose(
	equals( STATUS_PENDING ),
	statusView
) );

const getAssignableChats = compose(
	findPending,
	values,
	selectChatlist
);

export const getAllAssignableChats = compose(
	mapToChat,
	findPending,
	values,
	selectChatlist
);

export const haveAssignableChat = compose(
	not,
	isEmpty,
	getAssignableChats
);

export const getNextAssignableChat = compose(
	chatView,
	head,
	getAssignableChats
);

export const getClosedChatsOlderThan = ( ageInSeconds, state ) => compose(
	mapToChat,
	filter( both(
		compose( equals( STATUS_CLOSED ), statusView ),
		compose( lt( ageInSeconds * 1000 ), subtract( Date.now() ), timestampView )
	) ),
	values,
	selectChatlist
)( state );
