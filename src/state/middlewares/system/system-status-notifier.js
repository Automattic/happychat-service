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
	symmetricDifference
} from 'ramda';
import { throttle } from 'lodash';
import { notifySystemStatusChange } from '../../chatlist/actions';
import {
	getAvailableLocales,
	isAnyOperatorRequestingChat
} from '../../operator/selectors';
import { NOTIFY_SYSTEM_STATUS_CHANGE } from '../../action-types';

export default ( { getState, dispatch } ) => {
	let currentLocales = getAvailableLocales( getState() );
	let currentRequesting = isAnyOperatorRequestingChat( getState() );
	const dispatchIfUpdated = () => {
		const updatedLocales = getAvailableLocales( getState() );
		const updatedRequesting = isAnyOperatorRequestingChat( getState() );
		const updatedLocalesChanged = ! isEmpty( symmetricDifference( currentLocales, updatedLocales ) );
		const updatedRequestingChanged = currentRequesting !== updatedRequesting;

		if ( updatedLocalesChanged || updatedRequestingChanged ) {
			dispatch( notifySystemStatusChange( updatedLocales ) );
		}

		currentLocales = updatedLocales;
		currentRequesting = updatedRequesting;
	};
	const check = throttle( dispatchIfUpdated, 1000, { leading: true } );
	return next => action => {
		if ( action.type === NOTIFY_SYSTEM_STATUS_CHANGE ) {
			return next( action );
		}
		const result = next( action );
		check();
		return result;
	};
};
