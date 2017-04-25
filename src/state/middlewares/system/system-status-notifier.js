import {
	isEmpty,
	not,
	symmetricDifference
} from 'ramda'
import { throttle } from 'lodash'

import { notifySystemStatusChange } from '../../chatlist/actions'
import {
	getAvailableLocales,
	hasOperatorRequestingChat,
} from '../../operator/selectors'
import { NOTIFY_SYSTEM_STATUS_CHANGE } from '../../action-types'

export default ( { getState, dispatch } ) => {
	let currentLocales = getAvailableLocales( getState() );
	let currentRequestingChat = hasOperatorRequestingChat( getState() );
	const check = throttle( () => {
		const updatedLocales = getAvailableLocales( getState() );
		const updatedRequestingChat = hasOperatorRequestingChat( getState() );

		const changedLocales = not( isEmpty( symmetricDifference( currentLocales, updatedLocales ) ) );
		const changedRequesting = updatedRequestingChat === currentRequestingChat;
		if ( changedLocales || changedRequesting ) {
			dispatch( notifySystemStatusChange( updatedLocales ) );
		}
		currentLocales = updatedLocales;
		currentRequestingChat = updatedRequestingChat;
	}, 1000, { leading: true } );
	return next => action => {
		if ( action.type === NOTIFY_SYSTEM_STATUS_CHANGE ) {
			return next( action )
		}
		const result = next( action )
		check()
		return result;
	}
}