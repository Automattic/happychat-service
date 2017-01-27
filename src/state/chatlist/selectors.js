import {
	filter,
	compose,
	values,
	whereEq,
	lensProp,
	map,
	view,
	equals,
	both,
	defaultTo,
	isEmpty,
	head,
	not,
	prop,
	anyPass,
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
	curryN
} from 'ramda'
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
	STATUS_CLOSED
} from './reducer'
import {
	getDefaultLocale,
	getSupportedLocales
} from '../locales/selectors'
import {
	getGroup
} from '../groups/selectors'
import {
	DEFAULT_GROUP_ID
} from '../groups/reducer'

export const selectChatlist = view( lensProp( 'chatlist' ) )
const selectChat = id => compose(
	defaultTo( [] ),
	prop( id ),
	selectChatlist
)
const mapToChat = map( chatView )
const mapToMembers = map( membersView )
const matchingStatus = status => filter( compose( equals( status ), statusView ) )
const filterClosed = filter( compose( not, equals( STATUS_CLOSED ), statusView ) )
/*
Selects all chats assigned/associated with given operator id
*/
export const getChatsForOperator = ( operator_id, state ) => compose(
	// take the 2nd item (the chat)
	mapToChat,
	// filter the values of chat
	filter( compose(
		// compare operator.id to operator_id and match when equal
		whereEq( { id: operator_id } ),
		defaultTo( {} ),
		// take the 3rd item in chat row [STATUS, CHAT, OPERATOR]
		operatorView
	) ),
	// get the values of chat
	values,
	selectChatlist
)( state )

export const getOpenChatsForOperator = ( operator_id, state ) => compose(
	// take the 2nd item (the chat)
	mapToChat,
	// filter the values of chat
	filter( both(
		compose(
			// compare operator.id to operator_id and match when equal
			whereEq( { id: operator_id } ),
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
)( state )

export const getChatMembers = compose( mapToMembers, values, selectChatlist )

const getLocale = ( locale, state ) => {
	const systemLocale = getDefaultLocale( state )
	const supported = getSupportedLocales( state )
	return compose(
		when(
			compose( not, flip( contains )( supported ) ),
			always( systemLocale )
		),
		defaultTo( systemLocale ),
	)( locale )
}

export const getOpenChatMembers = state => compose(
	mapObjIndexed( mapToMembers ),
	groupBy( compose(
		flip( getLocale )( state ),
		localeView,
	) ),
	filterClosed,
	values,
	selectChatlist
)( state )

export const getAllChats = compose( mapToChat, values, selectChatlist )
export const getChatsWithStatus = ( status, state ) => compose(
	mapToChat,
	matchingStatus( status ),
	values,
	selectChatlist
)( state )

export const getAllNewChats = state => getChatsWithStatus( STATUS_NEW, state )

export const getOperatorAbandonedChats = ( id, state ) => compose(
	mapToChat,
	filter( both(
		compose( whereEq( { id } ), defaultTo( {} ), operatorView ),
		compose( equals( STATUS_ABANDONED ), statusView )
	) ),
	values,
	selectChatlist
)( state )

export const getAbandonedChats = ( state ) => getChatsWithStatus( STATUS_ABANDONED, state )
export const getMissedChats = ( state ) => getChatsWithStatus( STATUS_MISSED, state )

export const getChatOperator = ( chat_id, state ) => compose(
	operatorView,
	selectChat( chat_id )
)( state )

export const getChat = ( chat_id, state ) => compose(
	chatView,
	selectChat( chat_id ),
)( state )

export const getChats = state => compose(
	mapToChat,
	values,
	selectChatlist
)( state )

export const getChatStatus = ( chat_id, state ) => defaultTo( STATUS_NEW )( compose(
	statusView,
	selectChat( chat_id )
)( state ) )

export const isChatStatusNew = ( chat_id, state ) => equals(
	STATUS_NEW, getChatStatus( chat_id, state )
)

export const isChatStatusClosed = ( chat_id, state ) => equals(
	STATUS_CLOSED, getChatStatus( chat_id, state )
)

export const haveChatWithStatus = ( status, state ) => ! isEmpty(
	getChatsWithStatus( status, state )
)

export const havePendingChat = state => haveChatWithStatus( STATUS_PENDING, state )
export const getNextPendingChat = state => head(
	getChatsWithStatus( STATUS_PENDING, state )
)

export const haveMissedChat = state => haveChatWithStatus( STATUS_MISSED, state )
export const getNextMissedChat = state => head(
	getChatsWithStatus( STATUS_MISSED, state )
)

export const isAssigningChat = state => haveChatWithStatus( STATUS_ASSIGNING, state )

// Get the locale assigned to the chat. If no locale, use the system default
// If the locale is not explicity supported by the system, use the system default
export const getChatLocale = ( chat_id, state ) => compose(
	flip( getLocale )( state ),
	localeView,
	selectChat( chat_id )
)( state )

export const getChatGroups = ( chat_id, state ) => compose(
	// TODO: if a group is exclusive, only consider that group
	map( curryN( 2, flip( getGroup ) )( state ) ),
	when( either( isEmpty, isNil ), always( [ DEFAULT_GROUP_ID ] ) ),
	groupsView,
	selectChat( chat_id ),
)( state )

const getAssignableChats = compose(
	filter( compose(
		anyPass( map( equals, [ STATUS_NEW, STATUS_PENDING ] ) ),
		statusView
	) ),
	values,
	selectChatlist
)

export const haveAssignableChat = compose(
	not,
	isEmpty,
	getAssignableChats
)

export const getNextAssignableChat = compose(
	chatView,
	head,
	getAssignableChats
)

const now = () => ( new Date() ).getTime()

export const getClosedChatsOlderThan = ( ageInSeconds, state ) => compose(
	mapToChat,
	filter( both(
		compose( equals( STATUS_CLOSED ), statusView ),
		compose( lt( ageInSeconds * 1000 ), subtract( now() ), timestampView )
	) ),
	values,
	selectChatlist
)( state )
