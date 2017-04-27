import {
	isEmpty,
	not,
	symmetricDifference
} from 'ramda'
import { throttle } from 'lodash'

import { notifySystemStatusChange } from '../../chatlist/actions'
import { getAvailableLocales } from '../../operator/selectors'
import { NOTIFY_SYSTEM_STATUS_CHANGE } from '../../action-types'

const notifySystemStatus = ( { getState, dispatch } ) => {
	let current = getAvailableLocales( getState() )
	let check = throttle( () => {
		const updated = getAvailableLocales( getState() )
		if ( not( isEmpty( symmetricDifference( current, updated ) ) ) ) {
			dispatch( notifySystemStatusChange( updated ) )
		}
		current = updated
	}, 1000, { leading: true } )
	return next => action => {
		if ( action.type === NOTIFY_SYSTEM_STATUS_CHANGE ) {
			return next( action )
		}
		const result = next( action )
		check()
		return result;
	}
}

export default notifySystemStatus
