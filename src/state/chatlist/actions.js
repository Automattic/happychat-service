import {
	ASSIGN_NEXT_CHAT,
	ASSIGN_CHAT,
	ASSIGN_CHATS,
	CLOSE_CHAT,
	INSERT_PENDING_CHAT,
	REASSIGN_CHATS,
	RECOVER_CHATS,
	SET_CHAT_MISSED,
	SET_CHAT_OPERATOR,
	SET_CHATS_RECOVERED,
	SET_OPERATOR_CHATS_ABANDONED,
	TRANSFER_CHAT,
	SET_CHAT_CUSTOMER_DISCONNECT,
	NOTIFY_SYSTEM_STATUS_CHANGE,
	NOTIFY_CHAT_STATUS_CHANGED,
	AGENT_INBOUND_MESSAGE,
	AGENT_RECEIVE_MESSAGE,
	CUSTOMER_INBOUND_MESSAGE,
	OPERATOR_INBOUND_MESSAGE,
	OPERATOR_RECEIVE_MESSAGE,
	CUSTOMER_TYPING,
	CUSTOMER_RECEIVE_TYPING,
	CUSTOMER_RECEIVE_MESSAGE,
	CUSTOMER_JOIN,
	OPERATOR_JOIN,
	CUSTOMER_SOCKET_DISCONNECT,
	CUSTOMER_DISCONNECT,
	AUTOCLOSE_CHAT,
	CUSTOMER_LEFT,
	UPDATE_CHAT,
	RECEIVE_CHAT_MESSAGE,
	CUSTOMER_CHAT_TRANSCRIPT_REQUEST,
	REMOVE_CHAT,
	INSERT_NEW_CHAT
} from '../action-types'

export const reassignChats = ( operator, socket_id ) => ( {
	type: REASSIGN_CHATS, operator, socket_id
} )

export const setOperatorChatsAbandoned = ( operator_id ) => ( {
	type: SET_OPERATOR_CHATS_ABANDONED, operator_id
} )

export const recoverChats = ( operator, socket_id ) => ( {
	type: RECOVER_CHATS, operator, socket_id
} )

export const insertNewChat = chat => ( {
	type: INSERT_NEW_CHAT, chat
} )

export const insertPendingChat = chat => ( {
	type: INSERT_PENDING_CHAT, chat
} )

export const closeChat = ( chat_id, operator ) => ( {
	type: CLOSE_CHAT, chat_id, operator
} )

export const setChatMissed = ( chat_id, error ) => ( {
	type: SET_CHAT_MISSED, chat_id, error
} )

export const setChatOperator = ( chat_id, operator ) => ( {
	type: SET_CHAT_OPERATOR, chat_id, operator
} )

export const transferChat = ( chat_id, from, to ) => ( {
	type: TRANSFER_CHAT, chat_id, from, to
} )

export const setChatsRecovered = ( chat_ids, operator ) => ( {
	type: SET_CHATS_RECOVERED, chat_ids, operator
} )

export const setChatCustomerDisconnect = ( chat_id ) => ( {
	type: SET_CHAT_CUSTOMER_DISCONNECT, chat_id
} )

export const assignNextChat = () => ( {
	type: ASSIGN_NEXT_CHAT
} )

export const assignChats = ( { type: ASSIGN_CHATS } )

export const assignChat = chat => ( {
	type: ASSIGN_CHAT, chat
} )

export const notifySystemStatusChange = enabled => ( {
	type: NOTIFY_SYSTEM_STATUS_CHANGE, enabled
} )

export const notifyChatStatusChanged = ( chat_id, status, lastStatus ) => ( {
	type: NOTIFY_CHAT_STATUS_CHANGED, chat_id, status, lastStatus
} )

export const agentInboundMessage = ( agent, message ) => ( {
	type: AGENT_INBOUND_MESSAGE, agent, message
} )

export const agentReceiveMessage = message => ( {
	type: AGENT_RECEIVE_MESSAGE, message
} )

export const operatorInboundMessage = ( chat_id, user, message ) => ( {
	type: OPERATOR_INBOUND_MESSAGE, chat_id, user, message
} )

export const operatorReceiveMessage = ( id, message ) => ( {
	type: OPERATOR_RECEIVE_MESSAGE, id, message
} )

export const customerInboundMessage = ( chat, message ) => ( {
	type: CUSTOMER_INBOUND_MESSAGE, chat, message
} )

export const customerTyping = ( id, user, text ) => ( {
	type: CUSTOMER_TYPING, id, user, text
} )

export const customerReceiveTyping = ( id, user, text ) => ( {
	type: CUSTOMER_RECEIVE_TYPING, id, user, text
} )

export const customerReceiveMessage = ( id, message ) => ( {
	type: CUSTOMER_RECEIVE_MESSAGE, id, message
} )

export const customerJoin = ( socket_id, chat, user ) => ( {
	type: CUSTOMER_JOIN, socket_id, chat, user
} )

export const operatorJoinChat = ( chat, user ) => ( {
	type: OPERATOR_JOIN, chat, user
} )

export const customerSocketDisconnect = ( socket_id, chat, user ) => ( {
	type: CUSTOMER_SOCKET_DISCONNECT, socket_id, chat, user
} )

export const customerDisconnect = ( chat, user ) => ( {
	type: CUSTOMER_DISCONNECT, chat, user
} )

export const customerLeft = id => ( {
	type: CUSTOMER_LEFT, id
} )

export const autocloseChat = id => ( {
	type: AUTOCLOSE_CHAT, id
} )

export const receiveMessage = ( origin, chat, message, user ) => ( {
	type: RECEIVE_CHAT_MESSAGE, origin, chat, message, user
} )

export const updateChat = ( chat ) => ( {
	type: UPDATE_CHAT, chat
} )

export const customerChatTranscriptRequest = ( chat, timestamp ) => ( {
	type: CUSTOMER_CHAT_TRANSCRIPT_REQUEST, chat, timestamp
} )

export const removeChat = id => ( {
	type: REMOVE_CHAT, id
} )
