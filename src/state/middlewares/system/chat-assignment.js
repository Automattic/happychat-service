import { isEmpty, forEach, when } from 'ramda'

import { ASSIGN_NEXT_CHAT, ASSIGN_CHAT, NOTIFY_SYSTEM_STATUS_CHANGE, CUSTOMER_INBOUND_MESSAGE } from '../../action-types'
import { assignChat, setChatMissed, setChatOperator, insertPendingChat } from '../../chatlist/actions'
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
	isChatStatusAssigned
} from '../../chatlist/selectors'
import {
	haveAvailableCapacity,
	getAvailableOperators,
	canAcceptChat,
	isOperatorAcceptingChats
} from '../../operator/selectors'
import { handleActionType, handlers, beforeNextAction } from './handlers'

const debug = require( 'debug' )( 'happychat-debug:chat-assignment' )
const log = require( 'debug' )( 'happychat:chat-assignment' )

const handleAssignChat = ( { getState, dispatch } ) => ( action ) => {
	const { chat } = action
	debug( 'attempting to assign chat' )

	const locale = getChatLocale( chat.id, getState() )
	const groups = getChatGroups( chat.id, getState() )
	const list = getAvailableOperators( locale, groups, getState() )

	if ( isEmpty( list ) ) {
		return dispatch( setChatMissed( chat.id, new Error( 'no operators available' ) ) )
	}

	const [ next ] = list

	debug( 'assigning to operator', next )
	process.nextTick( () => dispatch( setChatOperator( chat.id, next ) ) )
}

const handleAssignNextChat = ( { getState, dispatch } ) => () => {
	if ( isAssigningChat( getState() ) ) {
		debug( 'already assigning chat, wait until complete' )
		return
	}

	if ( ! haveAssignableChat( getState() ) ) {
		// no chats waiting to be assigned
		return
	}

	const chats = getAllAssignableChats( getState() )
	for ( const chat of chats ) {
		const locale = getChatLocale( chat.id, getState() )
		const groups = getChatGroups( chat.id, getState() )
		debug( 'checking capacity to assign chat', locale, groups )

		if ( haveAvailableCapacity( locale, groups, getState() ) ) {
			return dispatch( assignChat( chat ) )
		}
		log( 'no capacity to assign chat', chat.id, locale, groups )
	}
}

const handleSystemStatusChange = store => () => {
	forEach(
		when(
			chat => canAcceptChat( chat.id, store.getState() ),
			chat => insertPendingChat( chat )
		),
		getAllMissedChats( store.getState() )
	)
}

const handleCustomerInboundMessage = store => ( { chat } ) => {
	const state = store.getState()
	const operator = getChatOperator( chat.id, state )
	const isNew = isChatStatusNew( chat.id, state )
	const isClosed = isChatStatusClosed( chat.id, state )
	const isAssigned = isChatStatusAssigned( chat.id, state )

	if ( operator && isOperatorAcceptingChats( operator.id, state ) && isClosed ) {
		store.dispatch( setChatOperator( chat.id, operator ) )
		return
	}

	if ( isAssigned && isEmpty( operator ) ) {
		store.dispatch( setChatMissed( chat.id ) )
		return
	}

	if ( isNew || isClosed ) {
		store.dispatch( insertPendingChat( chat ) )
		return
	}

	// TODO: check if there is an operator in the room
	debug( 'chat exists time to make sure someone is home' )
}

export default store => beforeNextAction( handlers(
	handleActionType( ASSIGN_NEXT_CHAT, handleAssignNextChat( store ) ),
	handleActionType( ASSIGN_CHAT, handleAssignChat( store ) ),
	handleActionType( NOTIFY_SYSTEM_STATUS_CHANGE, handleSystemStatusChange( store ) ),
	handleActionType( CUSTOMER_INBOUND_MESSAGE, handleCustomerInboundMessage( store ) )
) )

