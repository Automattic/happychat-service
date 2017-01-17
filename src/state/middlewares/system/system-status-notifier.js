import {
	isEmpty,
	not,
	symmetricDifference
} from 'ramda'

import { notifySystemStatusChange } from '../../chatlist/actions'
import { getAvailableLocales } from '../../operator/selectors'

const notifySystemStatus = ( { getState, dispatch } ) => next => action => {
	const previous = getAvailableLocales( getState() )
	const result = next( action )
	const current = getAvailableLocales( getState() )
	if ( not( isEmpty( symmetricDifference( previous, current ) ) ) ) {
		dispatch( notifySystemStatusChange( current ) )
	}
	return result;
}

export default notifySystemStatus
