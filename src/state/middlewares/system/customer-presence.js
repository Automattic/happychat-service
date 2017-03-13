import { cancelAction, delayAction } from 'redux-delayed-dispatch'
import { isEmpty, pipe, } from 'ramda'

import { whenActionTypeIs, beforeNextAction } from './handlers'
import { CUSTOMER_JOIN, CUSTOMER_DISCONNECT } from '../../action-types'

import { isChatStatusNew, getChatOperator, getChatStatus, isChatStatusClosed } from '../../chatlist/selectors'
import { updateChat, insertNewChat, setChatOperator, customerLeft, autocloseChat, removeChat, setChatCustomerDisconnect } from '../../chatlist/actions'
import { STATUS_CUSTOMER_DISCONNECT } from '../../chatlist/reducer'

const debug = require( 'debug' )( 'happychat-debug:customer-join' )

const onCustomerJoin = ( store ) => whenActionTypeIs( CUSTOMER_JOIN, action => {
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
	if ( operator && !isEmpty( operator ) && status === STATUS_CUSTOMER_DISCONNECT ) {
		store.dispatch( setChatOperator( chat.id, operator ) )
		return
	}
} )

const TEN_SECONDS = 10000
const NINETY_SECONDS = TEN_SECONDS * 9
const onCustomerDisconnect = ( store, { disconnectTimeout = NINETY_SECONDS, messageTimeout = TEN_SECONDS } ) => whenActionTypeIs( CUSTOMER_DISCONNECT, action => {
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
	store.dispatch( delayAction( customerLeft( chat.id ), messageTimeout ) )
	store.dispatch( delayAction( autocloseChat( chat.id ), disconnectTimeout ) )
} )

export default timeout => store => beforeNextAction( pipe(
	onCustomerJoin( store ),
	onCustomerDisconnect( store, { disconnectTimeout: timeout, messageTimeout: timeout } )
) )
