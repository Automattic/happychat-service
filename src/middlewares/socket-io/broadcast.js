import jsondiff from 'simperium-jsondiff'
import { v4 as uuid } from 'uuid'
import { OPERATOR_READY } from './index'
import { isEmpty, merge } from 'ramda'
import { selectSocketIdentity } from '../../operator/store'

const debug = require( 'debug' )( 'happychat:socket-io:broadcast' )

const REMOTE_ACTION_TYPE = 'REMOTE_ACTION_TYPE'

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

export default ( io, canRemoteDispatch = () => false, selector = ( state ) => state ) => ( { getState, dispatch } ) => {
	debug( 'initialized broadcaster' )
	const { diff } = jsondiff()
	let version = uuid()
	let currentState = selector( getState() )

	const listen = socket => {
		// socket needs to catch up to current state
		const stateListener = callback => callback( version, currentState )
		const dispatchListener = ( remoteAction, callback ) => {
			new Promise( ( resolve, reject ) => {
				const user = selectSocketIdentity( getState(), socket )
				const action = { type: REMOTE_ACTION_TYPE, action: remoteAction, socket, user }
				if ( canRemoteDispatch( action ) ) {
					dispatch( merge( action, { resolve, reject } ) )
				} else {
					reject( new Error( 'Remote dispatch not allowed' ) )
				}
			} )
			.then(
				r => callback( null, r ),
				e => callback( e )
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
				try {
					dispatch( action.action )
					action.resolve()
				} catch ( e ) {
					action.reject( e )
				}
				return next( action )
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
		const patch = diff( previousState, nextState )

		// TODO: throttle?

		if ( ! isEmpty( patch ) ) {
			const nextVersion = uuid()
			broadcastVersion( io, version, nextVersion, patch )
			version = nextVersion
			currentState = nextState
		}

		return result
	}
}
