/**
 * External dependencies
 */
import { merge, objOf } from 'ramda';

/**
 * Internal dependencies
 */
import { REMOTE_USER_KEY } from 'src/state/middlewares/socket-io/broadcast';

export const remoteAction = ( action, remoteUser = { id: 'remote-user' } ) => merge(
	action,
	objOf( REMOTE_USER_KEY, remoteUser )
);

export const tick = ( fn ) => ( ... args ) => process.nextTick( () => fn( ... args ) );
