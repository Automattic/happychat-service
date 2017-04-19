import { merge } from 'ramda'
import { beforeNextAction, handlers, handleActionType } from './handlers'
import { CUSTOMER_LEFT, CLOSE_CHAT, SET_CHAT_OPERATOR, OPERATOR_CHAT_JOIN, OPERATOR_CHAT_LEAVE, AUTOCLOSE_CHAT, CUSTOMER_BLOCK } from '../../action-types'
import { operatorInboundMessage } from '../../chatlist/actions'
import { getChatOperator } from '../../chatlist/selectors'
import makeEventMessage from './event-message'

export default store => beforeNextAction( handlers(
	handleActionType( CUSTOMER_LEFT, action => {
		const operator = getChatOperator( action.id, store.getState() )
		store.dispatch( operatorInboundMessage( action.id, operator, merge(
			makeEventMessage( 'customer left', action.id ),
			{ meta: { event_type: 'customer-leave' } }
		) ) )
	} ),
	handleActionType( CLOSE_CHAT, action => {
		const { chat_id, operator } = action
		store.dispatch( operatorInboundMessage( chat_id, operator, merge(
			makeEventMessage( 'chat closed', chat_id ),
			{ meta: { event_type: 'close', by: action.operator } }
		) ) )
	} ),
	handleActionType( SET_CHAT_OPERATOR, action => {
		let { operator, chat_id } = action
		store.dispatch( operatorInboundMessage( chat_id, operator, merge(
			makeEventMessage( 'operator assigned', chat_id ),
			{ meta: { operator, event_type: 'assigned' } }
		) ) )
	} ),
	handleActionType( OPERATOR_CHAT_JOIN, action => {
		const { chat_id, user: operator } = action
		store.dispatch( operatorInboundMessage( chat_id, operator, merge(
			makeEventMessage( 'operator joined', chat_id ),
			{	meta: { operator, event_type: 'join' } }
		) ) )
	} ),
	handleActionType( OPERATOR_CHAT_LEAVE, action => {
		const { chat_id, user: operator } = action
		store.dispatch( operatorInboundMessage( chat_id, operator, merge(
			makeEventMessage( 'operator left', chat_id ),
			{ meta: { operator, event_type: 'leave' } }
		) ) )
	} ),
	handleActionType( AUTOCLOSE_CHAT, action => {
		const { id: chat_id } = action
		store.dispatch( operatorInboundMessage( chat_id, {}, merge(
			makeEventMessage( 'chat closed after customer left', chat_id ),
			{ meta: { event_type: 'close' } }
		) ) )
	} ),
	handleActionType( CUSTOMER_BLOCK, action => {
		const { chat_id } = action;
		const operator = getChatOperator( chat_id, store.getState() );
		store.dispatch( operatorInboundMessage( chat_id, operator, merge(
			makeEventMessage( 'customer blocked', chat_id ),
			{ meta: { event_type: 'blocked', by: operator } }
		) ) );
	} )
) )
