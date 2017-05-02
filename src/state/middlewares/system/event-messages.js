/**
 * Event Messages Middleware
 *
 * Sends message to chat operators when relevant customer related events happen.
 */
import { merge } from 'ramda';
import { CUSTOMER_LEFT, CLOSE_CHAT, SET_CHAT_OPERATOR, OPERATOR_CHAT_JOIN,
	OPERATOR_CHAT_LEAVE, AUTOCLOSE_CHAT, CUSTOMER_BLOCK } from '../../action-types';
import { operatorInboundMessage } from '../../chatlist/actions';
import { getChatOperator } from '../../chatlist/selectors';
import makeEventMessage from './event-message';

export default store => {
	const handleCustomerLeft = action => {
		const operator = getChatOperator( action.id, store.getState() );
		store.dispatch( operatorInboundMessage( action.id, operator, merge(
			makeEventMessage( 'customer left', action.id ),
			{ meta: { event_type: 'customer-leave' } }
		) ) );
	};

	const handleCloseChat = action => {
		const { chat_id, operator } = action;
		store.dispatch( operatorInboundMessage( chat_id, operator, merge(
			makeEventMessage( 'chat closed', chat_id ),
			{ meta: { event_type: 'close', by: action.operator } }
		) ) );
	};

	const handleSetChatOperator = action => {
		const { operator, chat_id } = action;
		store.dispatch( operatorInboundMessage( chat_id, operator, merge(
			makeEventMessage( 'operator assigned', chat_id ),
			{ meta: { operator, event_type: 'assigned' } }
		) ) );
	};

	const handleOperatorChatJoin = action => {
		const { chat_id, user: operator } = action;
		store.dispatch( operatorInboundMessage( chat_id, operator, merge(
			makeEventMessage( 'operator joined', chat_id ),
			{	meta: { operator, event_type: 'join' } }
		) ) );
	};

	const handleOperatorChatLeave = action => {
		const { chat_id, user: operator } = action;
		store.dispatch( operatorInboundMessage( chat_id, operator, merge(
			makeEventMessage( 'operator left', chat_id ),
			{ meta: { operator, event_type: 'leave' } }
		) ) );
	};

	const handleAutocloseChat = action => {
		const { id: chat_id } = action;
		store.dispatch( operatorInboundMessage( chat_id, {}, merge(
			makeEventMessage( 'chat closed after customer left', chat_id ),
			{ meta: { event_type: 'close' } }
		) ) );
	};

	const handleCustomerBlock = action => {
		const { chat_id } = action;
		const operator = getChatOperator( chat_id, store.getState() );
		store.dispatch( operatorInboundMessage( chat_id, operator, merge(
			makeEventMessage( 'customer blocked', chat_id ),
			{ meta: { event_type: 'blocked', by: operator } }
		) ) );
	};

	return next => action => {
		switch ( action.type ) {
			case CUSTOMER_LEFT:
				handleCustomerLeft( action );
				break;
			case CLOSE_CHAT:
				handleCloseChat( action );
				break;
			case SET_CHAT_OPERATOR:
				handleSetChatOperator( action );
				break;
			case OPERATOR_CHAT_JOIN:
				handleOperatorChatJoin( action );
				break;
			case OPERATOR_CHAT_LEAVE:
				handleOperatorChatLeave( action );
				break;
			case AUTOCLOSE_CHAT:
				handleAutocloseChat( action );
				break;
			case CUSTOMER_BLOCK:
				handleCustomerBlock( action );
				break;
		}
		return next( action );
	};
};
