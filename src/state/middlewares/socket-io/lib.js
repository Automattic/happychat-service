import { REMOTE_USER_KEY } from './broadcast';

export const withRemoteUser = ( remoteAction, user ) => Object.assign( {}, remoteAction, {
	[ REMOTE_USER_KEY ]: {
		id: user.id
	}
} );
