/**
 * System Status Notifier middleware
 *
 * Checks changes in locale/group operator availabilitiy and dispatches
 * an action witch currently available locale groups when they change.
 *
 * Availability check is throttled to once a second.
 */

import {
	isEmpty,
	not,
	symmetricDifference
} from 'ramda';
import { throttle } from 'lodash';

import { notifySystemStatusChange } from '../../chatlist/actions';
import { getAvailableLocales } from '../../operator/selectors';
import { NOTIFY_SYSTEM_STATUS_CHANGE, SET_OPERATOR_REQUESTING_CHAT } from '../../action-types';

export default ( { getState, dispatch } ) => {
	let current = getAvailableLocales( getState() );
	const dispatchIfUpdated = () => {
		const updated = getAvailableLocales( getState() );
		if ( not( isEmpty( symmetricDifference( current, updated ) ) ) ) {
			dispatch( notifySystemStatusChange( updated ) );
		}
		current = updated;
	};
	const check = throttle( dispatchIfUpdated, 1000, { leading: true } );
	return next => action => {
		if ( action.type === NOTIFY_SYSTEM_STATUS_CHANGE ) {
			return next( action );
		}
		if ( action.type === SET_OPERATOR_REQUESTING_CHAT ) {
			dispatchIfUpdated();
			return next( action );
		}
		const result = next( action );
		check();
		return result;
	};
};
