export const ASSIGN_NEXT_CHAT = 'ASSIGN_NEXT_CHAT'
export const ASSIGN_CHAT = 'ASSIGN_CHAT'
export const CLOSE_CHAT = 'CLOSE_CHAT'
export const INSERT_PENDING_CHAT = 'INSERT_PENDING_CHAT'
export const REASSIGN_CHATS = 'REASSIGN_CHATS'
export const RECOVER_CHATS = 'RECOVER_CHATS'
export const SET_CHAT_MISSED = 'SET_CHAT_MISSED'
export const SET_CHAT_OPERATOR = 'SET_CHAT_OPERATOR'
export const SET_CHATS_RECOVERED = 'SET_CHATS_RECOVERED'
export const SET_OPERATOR_CHATS_ABANDONED = 'SET_OPERATOR_CHATS_ABANDONED'
export const TRANSFER_CHAT = 'TRANSFER_CHAT'
export const SET_CHAT_CUSTOMER_DISCONNECT = 'SET_CHAT_CUSTOMER_DISCONNECT'
export const NOTIFY_SYSTEM_STATUS_CHANGE = 'NOTIFY_SYSTEM_STATUS_CHANGE'
export const NOTIFY_CHAT_STATUS_CHANGED = 'NOTIFY_CHAT_STATUS_CHANGED'
export const AGENT_INBOUND_MESSAGE = 'AGENT_INBOUND_MESSAGE'
export const AGENT_RECEIVE_MESSAGE = 'AGENT_RECEIVE_MESSAGE'
export const CUSTOMER_INBOUND_MESSAGE = 'CUSTOMER_INBOUND_MESSAGE'
export const OPERATOR_INBOUND_MESSAGE = 'OPERATOR_INBOUND_MESSAGE'
export const OPERATOR_RECEIVE_MESSAGE = 'OPERATOR_RECEIVE_MESSAGE'
export const CUSTOMER_TYPING = 'CUSTOMER_TYPING'
export const CUSTOMER_RECEIVE_TYPING = 'CUSTOMER_RECEIVE_TYPING'
export const CUSTOMER_RECEIVE_MESSAGE = 'CUSTOMER_RECEIVE_MESSAGE'
export const CUSTOMER_JOIN = 'CUSTOMER_JOIN'
export const OPERATOR_JOIN = 'OPERATOR_JOIN'
export const CUSTOMER_SOCKET_DISCONNECT = 'CUSTOMER_SOCKET_DISCONNECT'
export const CUSTOMER_DISCONNECT = 'CUSTOMER_DISCONNECT'
export const AUTOCLOSE_CHAT = 'AUTOCLOSE_CHAT'
export const CUSTOMER_LEFT = 'CUSTOMER_LEFT'

export const reassignChats = ( operator, socket ) => ( {
	type: REASSIGN_CHATS, operator, socket
} )

export const setOperatorChatsAbandoned = ( operator_id ) => ( {
	type: SET_OPERATOR_CHATS_ABANDONED, operator_id
} )

export const recoverChats = ( operator, socket ) => ( {
	type: RECOVER_CHATS, operator, socket
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

export const customerJoin = ( socket, chat, user ) => ( {
	type: CUSTOMER_JOIN, socket, chat, user
} )

export const operatorJoinChat = ( socket, chat, user ) => ( {
	type: OPERATOR_JOIN, socket, chat, user
} )

export const customerSocketDisconnect = ( socket, chat, user ) => ( {
	type: CUSTOMER_SOCKET_DISCONNECT, socket, chat, user
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
