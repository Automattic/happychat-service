import jsondiff from 'simperium-jsondiff'
import { v4 as uuid } from 'uuid'
import { OPERATOR_READY } from './index'
import { isEmpty } from 'ramda'
import { selectSocketIdentity } from '../../operator/store'

const debug = require( 'debug' )( 'happychat:socket-io:broadcast' )

export const REMOTE_ACTION_TYPE = 'REMOTE_ACTION_TYPE'

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
	debug( 'patch', version )
	io.in( 'broadcast' ).emit( 'broadcast.update', version, nextVersion, patch )
}

export default ( io, canRemoteDispatch = () => false, selector = ( state ) => state ) => ( { getState, dispatch } ) => {
	debug( 'initialized broadcaster' )
	const { diff } = jsondiff()
	let version = uuid()
	let currentState = selector( getState() )
	let patch;

	const listen = socket => {
		// socket needs to catch up to current state
		const stateListener = callback => callback( version, currentState )
		const dispatchListener = ( remoteAction, callback ) => {
			debug( 'received remote dispatch', remoteAction.type )
			const user = selectSocketIdentity( getState(), socket )
			const action = { type: REMOTE_ACTION_TYPE, action: remoteAction, socket, user }
			if ( ! canRemoteDispatch( action, getState ) ) {
				debug( 'remote dispatch not allowed for action', remoteAction.type )
				callback( 'Remote dispatch not allowed' )
				return
			}
			dispatch( action ).then(
				result => callback( null, result ),
				e => callback( e.message )
			)
		}
		socket.on( 'broadcast.state', stateListener )
		socket.on( 'broadcast.dispatch', dispatchListener )
		socket.once( 'disconnect', () => {
			socket.removeListener( 'broadcast.state', stateListener )
			socket.removeListener( 'broadcast.dispatch', dispatchListener )
		} )
		return Promise.resolve( socket )
	}

	const sendState = socket => {
		debug( 'sending state' )
		socket.emit( 'broadcast.state', version, currentState )
	}

	return next => action => {
		switch ( action.type ) {
			case REMOTE_ACTION_TYPE:
				debug( 'handling REMOTE_ACTION_TYPE' )
				return new Promise( ( resolve, reject ) => {
					try {
						if ( action.action.version && action.action.version !== version ) {
							// if action is dispatched with a version number, require it to
							// be up to date with the server version
							return action.reject( new Error( 'out of date' ) )
						}
						dispatch( action.action )
						resolve( version )
					} catch ( e ) {
						reject( e.message )
					}
				} )
			// when the socket joins operators initialize them
			case OPERATOR_READY:
				join( io, action.socket )
				.then( listen )
				.then( sendState )
				.catch( e => debug( 'Failed to add user socket to broadcast', action.user.id, e ) )
				break;
		}

		const previousState = getState()
		const result = next( action )
		const nextState = currentState = selector( getState() )
		const nextPatch = diff( previousState, nextState )

		// TODO: throttle?

		if ( ! isEmpty( nextPatch ) ) {
			const nextVersion = uuid()
			patch = nextPatch
			broadcastVersion( io, version, nextVersion, patch )
			version = nextVersion
			currentState = nextState
		}

		return result
	}
}
