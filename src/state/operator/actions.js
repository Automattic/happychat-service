import {
	UPDATE_IDENTITY,
	REMOVE_USER,
	REMOVE_USER_SOCKET,
	OPERATOR_RECEIVE_TYPING,
	OPERATOR_OPEN_CHAT_FOR_CLIENTS,
	SET_SYSTEM_ACCEPTS_CUSTOMERS,
	SET_USER_LOADS,
	OPERATOR_TYPING,
	OPERATOR_CHAT_LEAVE,
	OPERATOR_CHAT_JOIN,
	OPERATOR_CHAT_TRANSCRIPT_REQUEST,
	OPERATOR_CHAT_TRANSCRIPT_RESPONSE,
	OPERATOR_CHAT_TRANSCRIPT_FAILURE,
	OPERATOR_SEND_CHAT_TRANSCRIPT_RESPONSE,
	OPERATOR_CHAT_TRANSFER,
	OPERATOR_READY,
	SET_OPERATOR_CAPACITY,
	SET_OPERATOR_STATUS,
	SET_USER_OFFLINE,
	CUSTOMER_BLOCK,
	JOIN_LOCALE,
	LEAVE_LOCALE,
	SEND_OPERATOR_CHAT_LOG
} from '../action-types'
import { allowRemote } from './can-remote-dispatch'

export const setUserOffline = user => ( {
	type: SET_USER_OFFLINE, user
} )

export const operatorTyping = ( id, user, text ) => (
	{ type: OPERATOR_TYPING, id, user, text }
)

export const updateIdentity = ( socket_id, user ) => (
	{ socket_id, user, type: UPDATE_IDENTITY }
)

export const removeUser = user => ( { user, type: REMOVE_USER } )

export const removeUserSocket = ( socket_id, user ) => (
	{ user, socket_id, type: REMOVE_USER_SOCKET }
)

export const setOperatorCapacity = allowRemote( SET_OPERATOR_CAPACITY, ( locale, capacity ) => ( {
	locale, capacity
} ) )

export const setOperatorStatus = allowRemote( SET_OPERATOR_STATUS, ( status ) => ( {
	status, type: SET_OPERATOR_STATUS
} ) )

export const setUserLoads = ( loads ) => ( {
	type: SET_USER_LOADS, loads
} )

export const operatorReceiveTyping = ( id, user, text ) => (
	{ type: OPERATOR_RECEIVE_TYPING, id, user, text }
)

export const operatorOpenChatForClients = ( operator, clients, room, chat, deferred, onDisconnect ) => (
	{ type: OPERATOR_OPEN_CHAT_FOR_CLIENTS, operator, clients, room, chat, deferred, onDisconnect }
)

export const setAcceptsCustomers = allowRemote( SET_SYSTEM_ACCEPTS_CUSTOMERS, ( isEnabled ) => (
	{ isEnabled }
) )

export const operatorChatLeave = ( chat_id, user ) => (
	{ type: OPERATOR_CHAT_LEAVE, chat_id, user }
)

export const customerBlock = ( chat_id, operator_id, user_id ) => (
	{ type: CUSTOMER_BLOCK, chat_id, operator_id, user_id }
);

export const operatorChatJoin = ( chat_id, user ) => (
	{ type: OPERATOR_CHAT_JOIN, chat_id, user }
)

export const operatorChatTransfer = ( chat_id, user, toUserId ) => (
	{ type: OPERATOR_CHAT_TRANSFER, chat_id, user, toUserId }
)

export const operatorReady = ( user, socket_id, room ) => (
	{ type: OPERATOR_READY, user, socket_id, room }
);

export const operatorChatTranscriptRequest = ( socketId, chat_id, timestamp ) => ( {
	type: OPERATOR_CHAT_TRANSCRIPT_REQUEST, socketId, chat_id, timestamp
} )

export const operatorChatTranscriptFailure = ( socketId, chat_id, errorMessage ) => ( {
	type: OPERATOR_CHAT_TRANSCRIPT_FAILURE, socketId, chat_id, errorMessage
} )

export const operatorChatTranscriptResponse = ( socketId, chat_id, timestamp, messages ) => ( {
	type: OPERATOR_CHAT_TRANSCRIPT_RESPONSE,
	socketId, chat_id, timestamp, messages
} )

export const sendOperatorChatTranscriptResponse = ( socketId, chat_id, timestamp, messages ) => ( {
	type: OPERATOR_SEND_CHAT_TRANSCRIPT_RESPONSE,
	socketId, chat_id, timestamp, messages
} )

export const joinLocale = allowRemote( JOIN_LOCALE, ( locale ) => ( {
	locale
} ) )

export const leaveLocale = allowRemote( LEAVE_LOCALE, ( locale ) => ( {
	locale
} ) )

export const sendOperatorChatLog = ( chatId, operatorId, log ) => ( {
	type: SEND_OPERATOR_CHAT_LOG, chatId, operatorId, log
} )
