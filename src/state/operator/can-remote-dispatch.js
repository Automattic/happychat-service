import { assoc, prop, defaultTo, always } from 'ramda'

const debug = require( 'debug' )( 'happychat:remote-action' )
const allowedTypes = {}

export const allowRemote = ( type, action, sentinel = always( true ) ) => {
	debug( 'allowing remote action', type )
	allowedTypes[type] = sentinel
	return ( ... args ) => assoc( 'type', type, action( ... args ) )
}

export default ( { action, user } ) => {
	if ( ! user ) {
		return false
	}

	return defaultTo(
		always( false ),
		prop( action.type, allowedTypes )
	)( { action, user } )
}
