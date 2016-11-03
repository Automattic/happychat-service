export const UPDATE_IDENTITY = 'UPDATE_IDENTITY'
export const REMOVE_USER = 'REMOVE_USER'
export const REMOVE_USER_SOCKET = 'REMOVE_USER_SOCKET'
export const UPDATE_USER_STATUS = 'UPDATE_USER_STATUS'
export const UPDATE_USER_CAPACITY = 'UPDATE_USER_CAPACITY';
export const UPDATE_AVAILABILITY = 'UPDATE_AVAILABILITY';
export const OPERATOR_RECEIVE = 'OPERATOR_RECEIVE';
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

export const setUserLoads = ( loads ) => ( {
	type: SET_USER_LOADS, loads
} )

export const updateAvailability = ( availability ) => (
	{ type: UPDATE_AVAILABILITY, availability }
)

export const operatorReceive = ( id, message ) => (
	{ type: OPERATOR_RECEIVE, id, message }
)

export const operatorReceiveTyping = ( chat, user, text ) => {
	const { id } = chat;
	return { type: OPERATOR_RECEIVE_TYPING, id, chat, user, text }
}

export const operatorChatOnline = ( id, identities ) => (
	{ type: OPERATOR_CHAT_ONLINE, id, identities }
);

export const operatorIdentifyClientRequest = ( clients, timeout, deferred ) => (
	{ type: OPERATOR_IDENTIFY_CLIENT_REQUEST, clients, timeout, deferred }
);

export const clientQuery = ( room, deferred ) => (
	{ type: CLIENT_QUERY, room, deferred }
)

export const operatorClientQuery = ( id, deferred ) => (
	{ type: OPERATOR_CLIENT_QUERY, id, deferred }
)

export const operatorOpenChatForClients = ( operator, clients, room, chat, deferred, onDisconnect ) => (
	{ type: OPERATOR_OPEN_CHAT_FOR_CLIENTS, operator, clients, room, chat, deferred, onDisconnect }
)

export const operatorLeaveChat = ( clients, room, operator_room, chat, deferred ) => (
	{ type: OPERATOR_LEAVE_CHAT, clients, room, operator_room, chat, deferred }
)

export const operatorChatClose = ( chat, room, operator ) => (
	{ type: OPERATOR_CLOSE_CHAT, chat, room, operator }
)

export const operatorQueryAvailability = ( clients, chat, deferred ) => (
	{ type: OPERATOR_QUERY_AVAILABILITY, clients, chat, deferred }
)

export const setAcceptsCustomers = ( isEnabled ) => (
	{ type: SET_SYSTEM_ACCEPTS_CUSTOMERS, isEnabled }
)
