import {
	UPDATE_IDENTITY,
	REMOVE_USER,
	REMOVE_USER_SOCKET,
	UPDATE_USER_STATUS,
	UPDATE_USER_CAPACITY,
	OPERATOR_RECEIVE_TYPING,
	OPERATOR_OPEN_CHAT_FOR_CLIENTS,
	SET_SYSTEM_ACCEPTS_CUSTOMERS,
	SET_USER_LOADS,
	OPERATOR_TYPING,
	OPERATOR_CHAT_LEAVE,
	OPERATOR_CHAT_JOIN,
	OPERATOR_CHAT_BACKLOG_REQUEST,
	OPERATOR_CHAT_TRANSFER,
	OPERATOR_READY,
	SET_OPERATOR_CAPACITY,
	SET_OPERATOR_STATUS,
	SET_USER_OFFLINE,
} from '../action-types'

export const setUserOffline = user => ( {
	type: SET_USER_OFFLINE, user
} )

export const operatorTyping = ( id, user, text ) => (
	{ type: OPERATOR_TYPING, id, user, text }
)

export const updateIdentity = ( socket, user ) => (
	{ socket, user, type: UPDATE_IDENTITY }
)

export const removeUser = user => ( { user, type: REMOVE_USER } )

export const removeUserSocket = ( socket, user ) => (
	{ user, socket, type: REMOVE_USER_SOCKET }
)

export const updateUserStatus = ( user, status ) => (
	{ user, status, type: UPDATE_USER_STATUS }
)

export const updateCapacity = ( user, capacity ) => (
	{ user, capacity, type: UPDATE_USER_CAPACITY }
)

export const setOperatorCapacity = ( capacity ) => ( {
	capacity, type: SET_OPERATOR_CAPACITY
} )

export const setOperatorStatus = ( status ) => ( {
	status, type: SET_OPERATOR_STATUS
} )

export const setUserLoads = ( loads ) => ( {
	type: SET_USER_LOADS, loads
} )

export const operatorReceiveTyping = ( id, user, text ) => (
	{ type: OPERATOR_RECEIVE_TYPING, id, user, text }
)

export const operatorOpenChatForClients = ( operator, clients, room, chat, deferred, onDisconnect ) => (
	{ type: OPERATOR_OPEN_CHAT_FOR_CLIENTS, operator, clients, room, chat, deferred, onDisconnect }
)

export const setAcceptsCustomers = ( isEnabled ) => (
	{ type: SET_SYSTEM_ACCEPTS_CUSTOMERS, isEnabled }
)

export const operatorChatLeave = ( chat_id, user ) => (
	{ type: OPERATOR_CHAT_LEAVE, chat_id, user }
)

export const operatorChatJoin = ( chat_id, user ) => (
	{ type: OPERATOR_CHAT_JOIN, chat_id, user }
)

export const operatorChatTransfer = ( chat_id, user, toUser ) => (
	{ type: OPERATOR_CHAT_TRANSFER, chat_id, user, toUser }
)

export const operatorReady = ( user, socket, room ) => (
	{ type: OPERATOR_READY, user, socket, room }
);
