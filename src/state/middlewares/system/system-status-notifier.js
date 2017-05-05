import {
	isEmpty,
	not,
	symmetricDifference
} from 'ramda'

import { notifySystemStatusChange } from '../../chatlist/actions'
import {
	getAvailableLocales,
	isAnyOperatorRequestingChat
} from '../../operator/selectors'
import { NOTIFY_SYSTEM_STATUS_CHANGE } from '../../action-types'

const notifySystemStatus = ( { getState, dispatch } ) => next => action => {
	if ( action.type === NOTIFY_SYSTEM_STATUS_CHANGE ) {
		return next( action )
	}

	const previous = getAvailableLocales( getState() );
	const previouslyRequestingChat = isAnyOperatorRequestingChat( getState() );
	const result = next( action );
	const current = getAvailableLocales( getState() );
	const requestingChat = isAnyOperatorRequestingChat( getState() );

	const localeAvailabilityChanged = ! isEmpty( symmetricDifference( previous, current ) );
	const requestingChatChanged = requestingChat !== previouslyRequestingChat;

	if ( requestingChatChanged || localeAvailabilityChanged ) {
		dispatch( notifySystemStatusChange( current ) )
	}
	return result;
}

export default notifySystemStatus
