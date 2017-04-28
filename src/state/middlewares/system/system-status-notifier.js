import {
	isEmpty,
	not,
	symmetricDifference
} from 'ramda'

import { notifySystemStatusChange } from '../../chatlist/actions'
import { getAvailableLocales } from '../../operator/selectors'
import {
	NOTIFY_SYSTEM_STATUS_CHANGE,
	SET_OPERATOR_REQUESTING_CHAT
} from '../../action-types'

const notifySystemStatus = ( { getState, dispatch } ) => next => action => {
	if ( action.type === NOTIFY_SYSTEM_STATUS_CHANGE ) {
		return next( action )
	}

	const previous = getAvailableLocales( getState() );
	const result = next( action );
	const current = getAvailableLocales( getState() );

	const localeAvailabilityChanged = ! isEmpty( symmetricDifference( previous, current ) );
	const requestingChatChanged = ( action.type === SET_OPERATOR_REQUESTING_CHAT );

	if ( requestingChatChanged || localeAvailabilityChanged ) {
		dispatch( notifySystemStatusChange( current ) )
	}
	return result;
}

export default notifySystemStatus
