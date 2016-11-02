import jsondiff from 'simperium-jsondiff'
import { v4 as uuid } from 'uuid'
import { OPERATOR_READY } from './index'
import { isEmpty } from 'ramda'
import { selectSocketIdentity } from '../../operator/store'

const debug = require( 'debug' )( 'happychat:socket-io:broadcast' )

const join = ( io, socket ) => new Promise( ( resolve, reject ) => {
	socket.join( 'broadcast', e => {
		if ( e ) {
			return reject( e )
		}
		debug( 'broadcasting to socket', socket.id )
		resolve( socket )
	} )
} )

const broadcastVersion = ( io, version, nextVersion, patch ) => {
	debug( 'patch', version, JSON.stringify( patch, null, '\t' ) )
	io.in( 'broadcast' ).emit( 'broadcast.update', version, nextVersion, patch )
}

export default ( io, selector = ( state ) => state ) => ( { getState } ) => {
	debug( 'initialized broadcaster' )
	const { diff } = jsondiff()
	let version = uuid()
	let currentState = selector( getState() )

	const listen = socket => {
		// socket needs to catch up to current state
		socket.on( 'broadcast.state', callback => callback( version, currentState ) )
		return Promise.resolve( socket )
	}

	const sendState = socket => {
		debug( 'sending state' )
		socket.emit( 'broadcast.state', version, currentState )
	}

	return next => action => {
		const previousState = getState()
		const result = next( action )
		const nextState = currentState = selector( getState() )
		const patch = diff( previousState, nextState )

		// TODO: throttle?

		if ( ! isEmpty( patch ) ) {
			const nextVersion = uuid()
			broadcastVersion( io, version, nextVersion, patch )
			version = nextVersion
			currentState = nextState
		}

		switch ( action.type ) {
			// when the socket joins operators initialize them
			case OPERATOR_READY:
				join( io, action.socket )
				.then( listen )
				.then( sendState )
				.catch( e => debug( 'Failed to add user socket to broadcast', action.user.id, e ) )
				break;
		}

		return result
	}
}
