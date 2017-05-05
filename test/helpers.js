import { REMOTE_USER_KEY } from 'state/constants';
import { merge, objOf } from 'ramda';

const debug = require( 'debug' )( 'happychat:test' );

export const remoteAction = ( action, remoteUser = { id: 'remote-user' } ) => merge(
	action,
	objOf( REMOTE_USER_KEY, remoteUser )
);

process.on( 'unhandledRejection', ( e ) => {
	debug( 'unhandled rejection', e, e.stack );
} );
