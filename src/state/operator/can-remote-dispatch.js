import { assoc, prop, defaultTo, always } from 'ramda';

const debug = require( 'debug' )( 'happychat-debug:remote-action' );
const allowedTypes = {};

/**
 * @typedef RemoteAction
 * @property { String } socket_id - Socket.IO socket id
 * @property { Object } user - identity of user performing dispatch
 * @property { Object } action - the redux action the user is attempting to dispatch
 */

/**
 * @callback Validator
 * @param { RemoteAction } remote action to validate
 * @param { Object } current redux state
 * @returns { boolean } true if the action dispatch should be allowed
 */

/**
 * Allows an action to be dispatched from a client connection.
 *
 * @param { String } type - action type that will be allowed
 * @param { Function } action - a redux action, type will be added automatically
 * @param { Validator } [sentinel] - function to validate
 * @returns { Funciton } redux action creator
 */
export const allowRemote = ( type, action, sentinel = always( true ) ) => {
	debug( 'allowing remote action', type );
	allowedTypes[ type ] = sentinel;
	return ( ... args ) => assoc( 'type', type, action( ... args ) );
};

export default ( { action, user } ) => {
	// If no user is associated with the dispatch it is not allowed
	if ( ! user ) {
		return false;
	}

	// if a type has been registered with allowRemote, use the validator
	// otherwise returns a validator that always returns false
	return defaultTo(
		always( false ),
		prop( action.type, allowedTypes )
	)( { action, user } );
};
