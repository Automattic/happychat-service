/**
 * Chat Assignment Middleware
 *
 * Responsible for assigning chats to operators. Determines when a chat should
 * be queue for assignment and picks the next available operator for that chat.
 */

import { isEmpty, forEach, when } from 'ramda';

import {
	ASSIGN_NEXT_CHAT,
	ASSIGN_CHAT,
	NOTIFY_SYSTEM_STATUS_CHANGE,
	CUSTOMER_INBOUND_MESSAGE,
	OPERATOR_READY,
	REMOVE_USER,
	SET_USER_OFFLINE
} from '../../action-types';
import {
	assignChat,
	setChatMissed,
	setChatOperator,
	insertPendingChat,
	reassignChats,
	recoverChats,
	setOperatorChatsAbandoned
} from '../../chatlist/actions';
import {
	getAllAssignableChats,
	haveAssignableChat,
	isAssigningChat,
	getChatLocale,
	getChatGroups,
	getAllMissedChats,
	getChatOperator,
	isChatStatusNew,
	isChatStatusClosed,
	isChatStatusAssigned,
	isChatStatusCustomerDisconnect
} from '../../chatlist/selectors';
import {
	haveAvailableCapacity,
	getAvailableOperators,
	canAcceptChat,
	isOperatorAcceptingChats,
	hasOperatorRequestingChat
} from '../../operator/selectors';

const debug = require( 'debug' )( 'happychat-debug:chat-assignment' );
const log = require( 'debug' )( 'happychat:chat-assignment' );

export default store => {
	// assign the given chat to an available operator
	const handleAssignChat = ( action ) => {
		const { chat } = action;
		debug( 'attempting to assign chat' );

		const locale = getChatLocale( chat.id, store.getState() );
		const groups = getChatGroups( chat.id, store.getState() );
		const list = getAvailableOperators( locale, groups, store.getState() );

		if ( isEmpty( list ) ) {
			return store.dispatch( setChatMissed( chat.id, new Error( 'no operators available' ) ) );
		}

		const [ next ] = list;

		debug( 'assigning to operator', next );
		process.nextTick( () => store.dispatch( setChatOperator( chat.id, next ) ) );
	};

	// Pick the next chat that needs to be assigned
	const handleAssignNextChat = () => {
		if ( isAssigningChat( store.getState() ) ) {
			debug( 'already assigning chat, wait until complete' );
			return;
		}

		if ( ! haveAssignableChat( store.getState() ) ) {
			// no chats waiting to be assigned
			return;
		}

		const chats = getAllAssignableChats( store.getState() );
		for ( const chat of chats ) {
			const locale = getChatLocale( chat.id, store.getState() );
			const groups = getChatGroups( chat.id, store.getState() );
			debug( 'checking capacity to assign chat', locale, groups );

			const isRequestingChat = hasOperatorRequestingChat( locale, groups, store.getState() );
			const isAvailableCapacity = haveAvailableCapacity( locale, groups, store.getState() );
			if ( isRequestingChat || isAvailableCapacity ) {
				return store.dispatch( assignChat( chat ) );
			}
			log( 'no capacity to assign chat', chat.id, locale, groups );
		}
	};

	// When system switches from not accepting chats to accepting chats
	// add all missed chats to chat assignment queue
	const handleSystemStatusChange = () => {
		forEach(
			when(
				chat => canAcceptChat( chat.id, store.getState() ),
				chat => insertPendingChat( chat )
			),
			getAllMissedChats( store.getState() )
		);
	};

	// When a customer sends a message, make sure the customer has an assigned
	// operator and if not queue the chat for assignment.
	const handleCustomerInboundMessage = ( { chat } ) => {
		const state = store.getState();
		const operator = getChatOperator( chat.id, state );
		const isNew = isChatStatusNew( chat.id, state );
		const isClosed = isChatStatusClosed( chat.id, state );
		const isAssigned = isChatStatusAssigned( chat.id, state );
		const isCustomerDisconnect = isChatStatusCustomerDisconnect( chat.id, state );

		if ( operator && isOperatorAcceptingChats( operator.id, state ) && ( isClosed || isCustomerDisconnect ) ) {
			store.dispatch( setChatOperator( chat.id, operator ) );
			return;
		}

		if ( isAssigned && isEmpty( operator ) ) {
			store.dispatch( setChatMissed( chat.id ) );
			return;
		}

		if ( isNew || isClosed || isCustomerDisconnect ) {
			store.dispatch( insertPendingChat( chat ) );
			return;
		}

		// TODO: check if there is an operator in the room
		debug( 'chat exists time to make sure someone is assigned' );
	};

	const handleOperatorReady = ( { user, socket_id } ) => {
		store.dispatch( recoverChats( user, socket_id ) );
		store.dispatch( reassignChats( user, socket_id ) );
	};

	const handleOperatorDisconnect = action => {
		store.dispatch( setOperatorChatsAbandoned( action.user.id ) );
	};
	return next => action => {
		switch ( action.type ) {
			case ASSIGN_NEXT_CHAT:
				handleAssignNextChat( action );
				break;
			case ASSIGN_CHAT:
				handleAssignChat( action );
				break;
			case NOTIFY_SYSTEM_STATUS_CHANGE:
				handleSystemStatusChange( action );
				break;
			case CUSTOMER_INBOUND_MESSAGE:
				handleCustomerInboundMessage( action );
				break;
			case OPERATOR_READY:
				handleOperatorReady( action );
				break;
			case REMOVE_USER:
			case SET_USER_OFFLINE:
				handleOperatorDisconnect( action );
				break;
		}
		return next( action );
	};
};

