import {
	assoc,
	isEmpty,
	map,
	mapObjIndexed,
	prop,
	reduce
} from 'ramda'

import {
	SET_CHAT_MISSED,
	SET_CHAT_OPERATOR,
	SET_CHAT_CUSTOMER_DISCONNECT,
	INSERT_PENDING_CHAT,
	ASSIGN_CHAT,
	SET_CHATS_RECOVERED,
	SET_OPERATOR_CHATS_ABANDONED
} from '../../action-types'
import { getChatStatus, getChatsForOperator } from '../../chatlist/selectors'
import { notifyChatStatusChanged } from '../../chatlist/actions'

const mapStatus = state => ids => reduce(
	( statuses, id ) => assoc( id, getChatStatus( id, state ), statuses ),
	{},
	ids
)

export default ( { getState, dispatch } ) => next => action => {
	// only actions that change the status of a chat
	let chat_ids = []
	switch ( action.type ) {
		// action.chat_id
		case SET_CHAT_MISSED:
		case SET_CHAT_OPERATOR:
		case SET_CHAT_CUSTOMER_DISCONNECT:
			chat_ids = [ action.chat_id ]
			break;
		// action.chat
		case INSERT_PENDING_CHAT:
		case ASSIGN_CHAT:
			chat_ids = [ action.chat.id ]
			break;
		// action.chat_ids
		case SET_CHATS_RECOVERED:
			chat_ids = action.chat_ids
			break;
		// select chats for operator action.operator_id
		case SET_OPERATOR_CHATS_ABANDONED:
			chat_ids = map(
				prop( 'id' ),
				getChatsForOperator( action.operator_id, getState() )
			)
			break;
	}

	if ( isEmpty( chat_ids ) ) {
		return next( action )
	}

	const previous = mapStatus( getState() )( chat_ids )
	const result = next( action )
	const current = mapStatus( getState() )( chat_ids )
	mapObjIndexed(
		( state, id ) => {
			if ( state !== previous[id] ) {
				dispatch( notifyChatStatusChanged( id, state, previous[id] ) )
			}
		},
		current
	)
	return result;
}
