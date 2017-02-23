import jsondiff from 'simperium-jsondiff'
import { v4 as uuid } from 'uuid'
import debounce from 'lodash/debounce'
import { OPERATOR_READY, REMOTE_ACTION_TYPE } from '../../action-types'
import { isEmpty } from 'ramda'
import { selectSocketIdentity } from '../../operator/selectors'
import { assoc, always, identity } from 'ramda'

const debug = require( 'debug' )( 'happychat:socket-io:broadcast' )

export const REMOTE_USER_KEY = 'REMOTE_USER_KEY'

const join = ( io, socket ) => new Promise( ( resolve, reject ) => {
	socket.join( 'broadcast', e => {
		if ( e ) {
			return reject( e )
		}
		resolve( socket )
	} )
} )

const broadcastVersion = ( io, version, nextVersion, patch ) => {
	io.in( 'broadcast' ).emit( 'broadcast.update', version, nextVersion, patch )
}

export default ( io, { canRemoteDispatch = always( false ), selector = identity, shouldBroadcastStateChange = always( true ) } ) => ( { getState, dispatch } ) => {
	const { diff } = jsondiff()
	let version = uuid()
	let currentState = selector( getState() )
	let patch;

	const listen = socket => {
		// socket needs to catch up to current state
		const stateListener = callback => callback( version, currentState )
		const dispatchListener = ( remoteAction, callback ) => {
			const user = selectSocketIdentity( getState(), socket )
			const action = {
				type: REMOTE_ACTION_TYPE,
				action: assoc( REMOTE_USER_KEY, user, remoteAction ),
				socket,
				user
			}
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
	}

	const sendState = socket => socket.emit( 'broadcast.state', version, currentState )

	const handleOperatorReady = action => {
		join( io, action.socket )
			.catch( e => debug( 'Failed to add user socket to broadcast', action.user.id, e.message ) )
		listen( action.socket )
		sendState( action.socket )
	}

	const broadcastChange = state => {
		const nextState = selector( state )
		const nextPatch = diff( currentState, nextState )

		if ( ! isEmpty( nextPatch ) ) {
			const nextVersion = uuid()
			patch = nextPatch
			broadcastVersion( io, version, nextVersion, patch )
			version = nextVersion
			currentState = nextState
		}
	}
	const update = debounce( broadcastChange, 20, { maxTime: 200 } )

	return next => action => {
		switch ( action.type ) {
			case REMOTE_ACTION_TYPE:
				return new Promise( ( resolve, reject ) => {
					try {
						if ( action.action.version && action.action.version !== version ) {
							// if action is dispatched with a version number, require it to
							// be up to date with the server version
							return action.reject( new Error( 'out of date' ) )
						}
						dispatch( action.action )
						broadcastChange( getState() )
						resolve( version )
					} catch ( e ) {
						reject( e.message )
					}
				} )
			// when the socket joins operators initialize them
			case OPERATOR_READY:
				handleOperatorReady( action )
				break;
		}

		if ( ! shouldBroadcastStateChange( action ) ) {
			return next( action )
		}

		const result = next( action )
		update( getState() )
		return result
	}
}
