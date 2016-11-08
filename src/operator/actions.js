export const UPDATE_IDENTITY = 'UPDATE_IDENTITY'
export const REMOVE_USER = 'REMOVE_USER'
export const REMOVE_USER_SOCKET = 'REMOVE_USER_SOCKET'
export const UPDATE_USER_STATUS = 'UPDATE_USER_STATUS'
export const UPDATE_USER_CAPACITY = 'UPDATE_USER_CAPACITY';
export const OPERATOR_RECEIVE_TYPING = 'OPERATOR_RECEIVE_TYPING';
export const OPERATOR_CHAT_ONLINE = 'OPERATOR_CHAT_ONLINE';
export const OPERATOR_IDENTIFY_CLIENT_REQUEST = 'OPERATOR_IDENTIFY_CLIENT_REQUEST'
export const CLIENT_QUERY = 'CLIENT_QUERY';
export const OPERATOR_CLIENT_QUERY = 'OPERATOR_CLIENT_QUERY';
export const OPERATOR_OPEN_CHAT_FOR_CLIENTS = 'OPERATOR_OPEN_CHAT_FOR_CLIENTS';
export const OPERATOR_LEAVE_CHAT = 'OPERATOR_LEAVE_CHAT';
export const OPERATOR_CLOSE_CHAT = 'OPERATOR_CLOSE_CHAT';
export const OPERATOR_QUERY_AVAILABILITY = 'OPERATOR_QUERY_AVAILABILITY';
export const SET_SYSTEM_ACCEPTS_CUSTOMERS = 'SET_SYSTEM_ACCEPTS_CUSTOMERS';
export const SET_USER_LOADS = 'SET_USER_LOADS';
export const OPERATOR_TRANSFER = 'OPERATOR_TRANSFER';
export const OPERATOR_REASSIGN = 'OPERATOR_REASSIGN';
export const OPERATOR_ASSIGN = 'OPERATOR_ASSIGN';
export const OPERATOR_RECOVER = 'OPERATOR_RECOVER';
export const OPERATOR_OPEN = 'OPERATOR_OPEN';
export const OPERATOR_LEAVE = 'OPERATOR_LEAVE';
export const OPERATOR_TYPING = 'OPERATOR_TYPING';
export const OPERATOR_CHAT_LEAVE = 'OPERATOR_CHAT_LEAVE';
export const OPERATOR_CHAT_JOIN = 'OPERATOR_CHAT_JOIN';
export const OPERATOR_CHAT_TRANSFER = 'OPERATOR_CHAT_TRANSFER';
export const OPERATOR_READY = 'OPERATOR_READY'
export const SET_OPERATOR_CAPACITY = 'SET_OPERATOR_CAPACITY';

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
