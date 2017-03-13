import { merge } from 'ramda'

import makeEventMessage from './event-message'
import { beforeNextAction, whenActionTypeIs } from './handlers'
import { OPERATOR_CHAT_TRANSFER } from '../../action-types'
import { selectUser } from '../../operator/selectors'
import { getChat } from '../../chatlist/selectors'
import { setChatMissed, setChatOperator, operatorInboundMessage } from '../../chatlist/actions'

const debug = require( 'debug' )( 'happychat-debug:transfer-chat' )

export default store => beforeNextAction( whenActionTypeIs( OPERATOR_CHAT_TRANSFER, action => {
	const { chat_id, toUserId, user } = action
	const toUser = selectUser( store.getState(), toUserId )
	const chat = getChat( chat_id, store.getState() )

	if ( !toUser ) {
		debug( 'failed to transfer chat, operator not available' )
		store.dispatch( setChatMissed( chat.id ) )
		return
	}

	store.dispatch( setChatOperator( chat.id, toUser ) )

	store.dispatch( operatorInboundMessage( chat.id, user, merge(
		makeEventMessage( 'chat transferred', chat_id ),
		{ meta: { from: user, to: toUser, event_type: 'transfer' } }
	) ) )
} ) )
