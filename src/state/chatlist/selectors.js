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
	not
} from 'ramda'
import {
	statusView,
	chatView,
	operatorView,
	membersView,
	STATUS_ABANDONED,
	STATUS_MISSED,
	STATUS_NEW,
	STATUS_PENDING,
	STATUS_ASSIGNING,
	STATUS_CLOSED
} from './reducer'

const selectChatlist = view( lensProp( 'chatlist' ) )
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
export const getOpenChatMembers = compose( mapToMembers, filterClosed, values, selectChatlist )
export const getAllChats = compose( mapToChat, values, selectChatlist )
export const getChatsWithStatus = ( status, state ) => compose(
	mapToChat,
	matchingStatus( status ),
	values,
	selectChatlist
)( state )

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
	defaultTo( [] ),
	view( lensProp( chat_id ) ),
	selectChatlist
)( state )

export const getChat = ( chat_id, state ) => compose(
	chatView,
	defaultTo( [] ),
	view( lensProp( chat_id ) ),
	selectChatlist
)( state )

export const getChats = state => compose(
	mapToChat,
	values,
	selectChatlist
)( state )

export const getChatStatus = ( chat_id, state ) => defaultTo( STATUS_NEW )( compose(
	statusView,
	defaultTo( [] ),
	view( lensProp( chat_id ) ),
	selectChatlist
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
