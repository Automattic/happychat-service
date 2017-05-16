/**
 * Customer Presence Middleware
 *
 * Determines if a customer is online or not.
 *
 * Dispatches event messages to chats when a customer is no longer online during
 * a chat session.
 *
 */
import { cancelAction, delayAction } from 'redux-delayed-dispatch'
import { isEmpty, defaultTo } from 'ramda'

import { CUSTOMER_JOIN, CUSTOMER_DISCONNECT } from '../../action-types'

import { isChatStatusNew, getChatOperator, getChatStatus, isChatStatusClosed } from '../../chatlist/selectors'
import { updateChat, insertNewChat, setChatOperator, customerLeft, autocloseChat, removeChat, setChatCustomerDisconnect } from '../../chatlist/actions'
import { STATUS_CUSTOMER_DISCONNECT } from '../../chatlist/reducer'

const debug = require( 'debug' )( 'happychat-debug:customer-join' )

const TEN_SECONDS = 10000
const NINETY_SECONDS = TEN_SECONDS * 9

export default timeout => store => {
	const handleCustomerJoin = action => {
		const { chat } = action

		if ( ! isChatStatusNew( chat.id, store.getState() ) ) {
			store.dispatch( updateChat( chat ) )
		} else {
			store.dispatch( insertNewChat( chat ) )
		}

		const status = getChatStatus( chat.id, store.getState() )
		const operator = getChatOperator( chat.id, store.getState() )
		store.dispatch( cancelAction( customerLeft( chat.id ) ) )
		store.dispatch( cancelAction( autocloseChat( chat.id ) ) )
		if ( operator && ! isEmpty( operator ) && status === STATUS_CUSTOMER_DISCONNECT ) {
			store.dispatch( setChatOperator( chat.id, operator ) )
			return
		}
	}

	const handleCustomerDisconnect = action => {
		debug( 'customer client disconnected' )
		const { chat } = action
		if ( isChatStatusNew( chat.id, store.getState() ) ) {
			debug( 'Customer disconnected without starting chat', chat.id )
			store.dispatch( removeChat( chat.id ) )
			return;
		}

		if ( isChatStatusClosed( chat.id, store.getState() ) ) {
			debug( 'Customer disconnected after chat closed' )
			return
		}
		store.dispatch( setChatCustomerDisconnect( chat.id ) )
		store.dispatch( delayAction( customerLeft( chat.id ), defaultTo( TEN_SECONDS, timeout ) ) )
		store.dispatch( delayAction( autocloseChat( chat.id ), defaultTo( NINETY_SECONDS, timeout ) ) )
	}

	return next => action => {
		switch ( action.type ) {
			case CUSTOMER_JOIN:
				handleCustomerJoin( action );
				break;
			case CUSTOMER_DISCONNECT:
				handleCustomerDisconnect( action );
				break;
		}
		return next( action );
	}
}
