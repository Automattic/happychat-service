import {
	ASSIGN_NEXT_CHAT,
	ASSIGN_CHAT,
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
	INSERT_NEW_CHAT,
	SEND_CUSTOMER_CHAT_LOG
} from '../action-types';

/**
 * When an operator joins from another connection they should receive the same chat.
 * assignments.
 *
 * @param { Object } operator - the operator identity that is being reassigned
 * @param { String } socket_id - the socket.io socket id for the connection
 * @returns { Object } - redux action describing the reassign action
 */
export const reassignChats = ( operator, socket_id ) => ( {
	type: REASSIGN_CHATS, operator, socket_id
} );

/**
 * All chats assigned to the specificed operator_id will be set as STATUS_ABANDONED
 *
 * @param { String } operator_id - the id of the operator whose chats should be changed
 *                                 to abandoned
 * @returns { Object } redux action
 */
export const setOperatorChatsAbandoned = ( operator_id ) => ( {
	type: SET_OPERATOR_CHATS_ABANDONED, operator_id
} );

/**
 * When an operator returns from completely disconnecting, all abandoned chats assigned
 * to the operator are set to assigned status and openend for the connecting operator.
 *
 * @param { Object } operator - operator identity
 * @param { String } socket_id - Socket.IO client id
 * @returns { Object } redux action
 */
export const recoverChats = ( operator, socket_id ) => ( {
	type: RECOVER_CHATS, operator, socket_id
} );

/**
 * Adds a customer chat to the chatlist with a status with STATUS_NEW. The customer
 * at this point has connected but not requested a chat so chat will not be assigned.
 *
 * @param { Object } chat - chat describing the user and session context
 * @returns { Object } redux action
 */
export const insertNewChat = chat => ( {
	type: INSERT_NEW_CHAT, chat
} );

/**
 * Adds or updates a chat to STATUS_PENDING. The chat will be assigned to the next
 * available operator.
 *
 * @param { Object } chat - chat describing the user and session context
 * @returns { Object } redux action
 */
export const insertPendingChat = chat => ( {
	type: INSERT_PENDING_CHAT, chat
} );

/**
 * Changes chat's status to closed.
 *
 * @param { String } chat_id - id of the chat
 * @param { Object } operator - the operator closing the chat
 * @returns { Object } redux action
 */
export const closeChat = ( chat_id, operator ) => ( {
	type: CLOSE_CHAT, chat_id, operator
} );

/**
 * Sets a chat's status as missed indicating that it could not be assigned to
 * an operator.
 *
 * @param { String } chat_id - the id of the chat
 * @param { Error } error - the reason the chat was not assigned
 * @returns { Object } redux action
 */
export const setChatMissed = ( chat_id, error ) => ( {
	type: SET_CHAT_MISSED, chat_id, error
} );

/**
 * Sets a chat's status as assigned to the given operator.
 *
 * @param { String } chat_id - id of the chat
 * @param { Object } operator - identity of the operator assigned to the chat
 * @returns { Object } redux action
 */
export const setChatOperator = ( chat_id, operator ) => ( {
	type: SET_CHAT_OPERATOR, chat_id, operator
} );

/**
 * Transfers a chat assignment from one operator to another
 *
 * @param { String } chat_id - id of the chat
 * @param { Object } from - identity of the operator originally assigned
 * @param { Object } to - identity of the operator receiving chat assignment
 * @returns { Object } redux action
 */
export const transferChat = ( chat_id, from, to ) => ( {
	type: TRANSFER_CHAT, chat_id, from, to
} );

/**
 * Marks the chats assigned to the given operator as assigned from whatever status they
 * were (most likely abandoned).
 *
 * @param { string[] } chat_ids - array of chat ids to recover
 * @param { Object } operator - identity of the operator to be assigned to the chats
 * @returns { Object } redux action
 */
export const setChatsRecovered = ( chat_ids, operator ) => ( {
	type: SET_CHATS_RECOVERED, chat_ids, operator
} );

/**
 * Sets a chat's status to indicate the customer has completely disconnected
 *
 * @param { string } chat_id - the chat's id
 * @returns { Object } redux action
 */
export const setChatCustomerDisconnect = ( chat_id ) => ( {
	type: SET_CHAT_CUSTOMER_DISCONNECT, chat_id
} );

/**
 * The system should try to assign the next chat in the chat list.
 * @returns { Object } redux action
 */
export const assignNextChat = () => ( {
	type: ASSIGN_NEXT_CHAT
} );

/**
 * The system should assign the given chat the next operator available.

 * @param { Object } chat - the chat session context
 * @returns { Object } redux action
 */
export const assignChat = chat => ( {
	type: ASSIGN_CHAT, chat
} );

/**
 * Indicates that the system's ability to receive chats has changed.
 *
 * @param { Object[] } enabled - a list of locales from getAvailableLocales
 * @returns { Object } redux action
 */
export const notifySystemStatusChange = enabled => ( {
	type: NOTIFY_SYSTEM_STATUS_CHANGE, enabled
} );

/**
 * Dispatched when a chat's status has changed
 *
 * @param { string } chat_id - the id of the chat
 * @param { string } status - the chat's new status
 * @param { string } lastStatus - the chat's previous status
 * @returns { Object } redux action
 */
export const notifyChatStatusChanged = ( chat_id, status, lastStatus ) => ( {
	type: NOTIFY_CHAT_STATUS_CHANGED, chat_id, status, lastStatus
} );

/**
 * Agent connection is sending a message into the system
 *
 * @param { Object } agent - identity of the agent
 * @param { Objcet } message - the message being sent
 * @returns { Object } redux action
 */
export const agentInboundMessage = ( agent, message ) => ( {
	type: AGENT_INBOUND_MESSAGE, agent, message
} );

/**
 * Agent connection is receiving a message from the system
 *
 * @param { Objcet } message - the message being sent to the agent
 * @returns { Object } redux action
 */
export const agentReceiveMessage = message => ( {
	type: AGENT_RECEIVE_MESSAGE, message
} );

/**
 * operator connection is sending a message into the system
 *
 * @param { String } chat_id - The id of the chat the message is for
 * @param { Object } user - The identity of the operator sending the message
 * @param { Object } message - The message being sent by the connection
 * @returns { Object } redux action
 */
export const operatorInboundMessage = ( chat_id, user, message ) => ( {
	type: OPERATOR_INBOUND_MESSAGE, chat_id, user, message
} );

/**
 * Operator is receiving a message from the system.
 *
 * @param { String } chat_id - The id of the chat
 * @param { Object } message - The message being sent to the operator
 * @returns { Object } redux action
 */
export const operatorReceiveMessage = ( chat_id, message ) => ( {
	type: OPERATOR_RECEIVE_MESSAGE, id: chat_id, message
} );

/**
 * Customer is sending a message into the system
 *
 * @param { Object } chat - describes the user and session
 * @param { Object } message - the message being sent by the customer connection
 * @returns { Object } redux action
 */
export const customerInboundMessage = ( chat, message ) => ( {
	type: CUSTOMER_INBOUND_MESSAGE, chat, message
} );

/**
 * Customer is receiving a message from the system.
 *
 * @param { String } chat_id - The id of the chat
 * @param { Object } message - The message being sent to the operator
 * @returns { Object } redux action
 */
export const customerReceiveMessage = ( chat_id, message ) => ( {
	type: CUSTOMER_RECEIVE_MESSAGE, id: chat_id, message
} );

/**
 * Customer connection is indicating that the user is typing.
 *
 * @param { string } chat_id - id of the chat
 * @param { Object } user - identity of the user typing
 * @param { string } text - the value of what the user has typed
 * @returns { Object } redux action
 */
export const customerTyping = ( chat_id, user, text ) => ( {
	type: CUSTOMER_TYPING, id: chat_id, user, text
} );

/**
 * Customer connection is being notified of a typing indicator
 *
 * @param { string } chat_id - The id of the chat
 * @param { Object } user - The identity of the user typing
 * @param { string } text - The text that has been typed
 * @returns { Object } redux action
 */
export const customerReceiveTyping = ( chat_id, user, text ) => ( {
	type: CUSTOMER_RECEIVE_TYPING, id: chat_id, user, text
} );

/**
 * A customer connection has authenticated and joined the system.
 *
 * @param { Object } chat - The session context for the chat
 * @param { Object } user - The identity of the customer
 * @returns { Object } redux action
 */
export const customerJoin = ( chat, user ) => ( {
	type: CUSTOMER_JOIN, chat, user
} );

/**
 * An operator has joined a chat and will receive events related to the chat.
 *
 * @param { Object } chat - the chat session context
 * @param { Object } user - the identity of the operator joining the chat
 * @returns { Object } redux action
 */
export const operatorJoinChat = ( chat, user ) => ( {
	type: OPERATOR_JOIN, chat, user
} );

/**
 * A customer's socket has disconnected
 *
 * @param { string } socket_id - the socket.io id of the connection
 * @param { Object } chat - the chat session context
 * @param { Object } user - the customer's identity
 * @returns { Object } redux action
 */
export const customerSocketDisconnect = ( socket_id, chat, user ) => ( {
	type: CUSTOMER_SOCKET_DISCONNECT, socket_id, chat, user
} );

/**
 * A customer has completesy disconnected from the server.
 *
 * @param { Object } chat - the chat session context
 * @param { Object } user - the customer's identity
 * @returns { Object } redux action
 */
export const customerDisconnect = ( chat, user ) => ( {
	type: CUSTOMER_DISCONNECT, chat, user
} );

/**
 * The customer has left the chat. Used to send a message to operator chats.
 *
 * @param { String } chat_id - the chat id
 * @returns { Object } redux action
 */
export const customerLeft = chat_id => ( {
	type: CUSTOMER_LEFT, id: chat_id
} );

/**
 * Close a chat due to an inactive customer.
 *
 * @param { string } chat_id - id of the chat closing
 * @returns { Object } redux action
 */
export const autocloseChat = chat_id => ( {
	type: AUTOCLOSE_CHAT, id: chat_id
} );

/**
 * A chat message is being received from a connection.
 *
 * @param { string } origin - customer, operator, agent
 * @param { Object } chat - the chat session context
 * @param { Object } message - the message being received
 * @param { Object } user - the identity of the user sending the message
 * @returns { Object } redux action
 */
export const receiveMessage = ( origin, chat, message, user ) => ( {
	type: RECEIVE_CHAT_MESSAGE, origin, chat, message, user
} );

/**
 * Update a chat indexed at the given chat.id with the chat details.
 *
 * @param { Object } chat - chat session context
 * @returns { Object } redux action
 */
export const updateChat = ( chat ) => ( {
	type: UPDATE_CHAT, chat
} );

export const customerChatTranscriptRequest = ( chat_id, timestamp ) => ( {
	type: CUSTOMER_CHAT_TRANSCRIPT_REQUEST, chat_id, timestamp
} );

/**
 * Remove a chat from the system
 *
 * @param { string } chat_id - id of the chat to remove
 * @returns { Object } redux action
 */
export const removeChat = chat_id => ( {
	type: REMOVE_CHAT, id: chat_id
} );

/**
 * Sends the cached customer chat log to the customer connection
 *
 * @param { string } chat_id - id of the chat to receive the log
 * @param { Object[] } log - list of messages to send to che customer
 * @returns { Object } redux action
 */
export const sendCustomerChatLog = ( chat_id, log ) => ( {
	type: SEND_CUSTOMER_CHAT_LOG, id: chat_id, log
} );

