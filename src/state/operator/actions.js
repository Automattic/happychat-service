import {
	UPDATE_IDENTITY,
	REMOVE_USER,
	REMOVE_USER_SOCKET,
	OPERATOR_RECEIVE_TYPING,
	SET_SYSTEM_ACCEPTS_CUSTOMERS,
	SET_USER_LOADS,
	OPERATOR_TYPING,
	OPERATOR_CHAT_LEAVE,
	OPERATOR_CHAT_JOIN,
	OPERATOR_CHAT_TRANSCRIPT_REQUEST,
	OPERATOR_CHAT_TRANSFER,
	OPERATOR_READY,
	SET_OPERATOR_REQUESTING_CHAT,
	SET_OPERATOR_CAPACITY,
	SET_OPERATOR_STATUS,
	SET_USER_OFFLINE,
	CUSTOMER_BLOCK,
	JOIN_LOCALE,
	LEAVE_LOCALE,
	SEND_OPERATOR_CHAT_LOG
} from '../action-types';
import { allowRemote } from './can-remote-dispatch';

/**
 * @param { Object } user - operator user record
 * @returns { Object } redux action
 */
export const setUserOffline = user => ( {
	type: SET_USER_OFFLINE, user
} );

/**
 * @param { String } id - id of chat operator is typing in
 * @param { Object } user - identity of operator typing
 * @param { String } text - the text the operator is currently typing
 * @returns { Object } redux action
 */
export const operatorTyping = ( id, user, text ) => (
	{ type: OPERATOR_TYPING, id, user, text }
);

/**
 * Update the operator identity associated with the given Socket.IO socket id
 *
 * @param { String } socket_id - Socket.IO socket id
 * @param { Object } user - operator identity
 * @returns { Object } redux action
 */
export const updateIdentity = ( socket_id, user ) => (
	{ socket_id, user, type: UPDATE_IDENTITY }
);

/**
 * Removes operator from the system
 *
 * @param { Object } user - operator identity to remove
 * @returns { Object } redux action
 */
export const removeUser = user => ( { user, type: REMOVE_USER } );

/**
 * Removes a socket connection mapping for an operator
 *
 * @param { String } socket_id - Socket.IO client socket id
 * @param { Object } user - operator identity
 * @returns { Object } redux action
 */
export const removeUserSocket = ( socket_id, user ) => (
	{ user, socket_id, type: REMOVE_USER_SOCKET }
);

/**
 * Remotely dispatched from a client to set an operator's locale capacity.
 *
 * Operator identity is assigned to the action when the broadcast module
 * authenticates the dispatch.
 *
 * @function
 * @param { String } locale - code for locale to be updated
 * @param { number } capacity - new capacity to set
 * @returns { Object } redux action
 */
export const setOperatorCapacity = allowRemote( SET_OPERATOR_CAPACITY, ( locale, capacity ) => ( {
	locale, capacity
} ) );

/**
 * Remotely dispatched from a client to update an operator's status.
 *
 * Operator identity is assigned to the action when the broadcast module
 * authenticates the dispatch.
 *
 * @function
 * @param { String } status - operator's new status
 * @returns { Object } redux action
 */
export const setOperatorStatus = allowRemote( SET_OPERATOR_STATUS, ( status ) => ( {
	status, type: SET_OPERATOR_STATUS
} ) );

export const setOperatorRequestingChat = allowRemote( SET_OPERATOR_REQUESTING_CHAT, ( requestingChat ) => ( {
	requestingChat
} ) );

/**
 * @param { Object } loads - mapping of loads to assign to users with a locale
 * @returns { Object } redux action
 */
export const setUserLoads = ( loads ) => ( {
	type: SET_USER_LOADS, loads
} );

/**
 * Operator is being sent a typing indicator
 *
 * @param { String } id - id of chat typing indicator is for
 * @param { Object } user - identity of the person typing
 * @param { String } text - the content being typed
 * @returns { Object } redux action
 */
export const operatorReceiveTyping = ( id, user, text ) => (
	{ type: OPERATOR_RECEIVE_TYPING, id, user, text }
);

/**
 * @function
 * @param { Boolean } isEnabled - if true system will accept new customer chats
 * @returns { Object } redux action
 */
export const setAcceptsCustomers = allowRemote( SET_SYSTEM_ACCEPTS_CUSTOMERS, ( isEnabled ) => (
	{ isEnabled }
) );

/**
 * @param { String } chat_id - chat the operator is leaving
 * @param { Object } user - operator identity leaving chat
 * @returns { Object } redux action
 */
export const operatorChatLeave = ( chat_id, user ) => (
	{ type: OPERATOR_CHAT_LEAVE, chat_id, user }
);

/**
 * @param { String } chat_id - the chat the operator is joining
 * @param { Object } user - identity of operator joining the chat
 * @returns { Object } redux action
 */
export const operatorChatJoin = ( chat_id, user ) => (
	{ type: OPERATOR_CHAT_JOIN, chat_id, user }
);

/**
 * @param { String } chat_id - id of chat block is in
 * @param { String } operator_id - the id of the operator performing the block
 * @param { String } user_id - the user being blocked
 * @returns { Object } redux action
 */
export const customerBlock = ( chat_id, operator_id, user_id ) => (
	{ type: CUSTOMER_BLOCK, chat_id, operator_id, user_id }
);

/**
 * @param { String } chat_id - chat being transfered
 * @param { Object } user - identity of operator starting the transfer
 * @param { String } toUserId - id of the operator receiving the transfer
 * @returns { Object } redux action
 */
export const operatorChatTransfer = ( chat_id, user, toUserId ) => (
	{ type: OPERATOR_CHAT_TRANSFER, chat_id, user, toUserId }
);

/**
 * @param { Object } user - operator identity
 * @param { String } socket_id - Socket.IO client id
 * @param { String } room - the user's Socket.IO room
 * @returns { Object } redux action
 */
export const operatorReady = ( user, socket_id, room ) => (
	{ type: OPERATOR_READY, user, socket_id, room }
);

/**
 * @returns { Object } redux action
 */
export const operatorChatTranscriptRequest = ( chat_id, timestamp ) => ( {
	type: OPERATOR_CHAT_TRANSCRIPT_REQUEST, chat_id, timestamp
} );

/**
 * @function
 * @param { String } locale - the locale code of the locale the operator is joining
 * @returns { Object } redux action
 */
export const joinLocale = allowRemote( JOIN_LOCALE, ( locale ) => ( {
	locale
} ) );

/**
 * @function
 * @param { String } locale - the locale code of the locale the operator is leavign
 * @returns { Object } redux action
 */
export const leaveLocale = allowRemote( LEAVE_LOCALE, ( locale ) => ( {
	locale
} ) );

/**
 * @param { String } chatId - id of chat the log is for
 * @param { String } operatorId - the operator receiving the chat
 * @param { Object[] } log - list of messages for the chat
 * @returns { Object } redux action
 */
export const sendOperatorChatLog = ( chatId, operatorId, log ) => ( {
	type: SEND_OPERATOR_CHAT_LOG, chatId, operatorId, log
} );
