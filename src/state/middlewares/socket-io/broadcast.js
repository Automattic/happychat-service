import jsondiff from 'simperium-jsondiff'
import { v4 as uuid } from 'uuid'
import { debounce } from 'lodash'
import { REMOTE_ACTION_TYPE } from '../../action-types'
import { isEmpty } from 'ramda'
import { assoc, always, identity } from 'ramda'

const debug = require( 'debug' )( 'happychat-debug:socket-io:broadcast' )
const log = require( 'debug' )( 'happychat:socket-io:broadcast' )

export const REMOTE_USER_KEY = 'REMOTE_USER'
const BROADCAST_REQUEST_STATE = 'BROADCAST_REQUEST_STATE'

const requestState = ( socketId ) => ( {
	type: BROADCAST_REQUEST_STATE,
	socketId
} )

const join = ( io, socket ) => new Promise( ( resolve, reject ) => {
	socket.join( 'broadcast', e => {
		if ( e ) {
			return reject( e )
		}
		resolve( socket )
	} )
} )

const broadcastVersion = ( io, version, nextVersion, patch ) => {
	debug( 'broadcasting version %s', version )
	io.in( 'broadcast' ).emit( 'broadcast.update', version, nextVersion, patch )
}

const getTime = () => ( new Date() ).getTime()

const measure = ( label, work, logWhenLongerThan = 100 ) => ( ... args ) => {
	const startTime = getTime()
	const result = work( ... args )
	const endTime = getTime()
	const ellapsed = endTime - startTime
	if ( ellapsed > logWhenLongerThan ) {
		log( `task ${ label } completed in ${ ellapsed }ms` )
	}
	return result
}

export default ( io, { canRemoteDispatch = always( false ), selector = identity, shouldBroadcastStateChange = always( true ) } ) => ( { getState, dispatch } ) => {
	const { diff } = jsondiff()
	let version = uuid()
	let currentState = selector( getState() )
	let patch;

	const measureDiff = measure( 'diff', diff )

	const broadcastChange = state => {
		const nextState = selector( state )
		const nextPatch = measureDiff( currentState, nextState )

		if ( ! isEmpty( nextPatch ) ) {
			const nextVersion = uuid()
			patch = nextPatch
			broadcastVersion( io, version, nextVersion, patch )
			version = nextVersion
			currentState = nextState
		}
	}

	const sendState = socket => {
		dispatch( requestState( socket.id ) )
	}

	const listen = ( socket, user ) => {
		// socket needs to catch up to current state
		// todo this now needs to be dispatched so the prime reducer can send
		// the actual state in the event that this is a worker
		const stateListener = () => {
			debug( 'socket is requesting current state', socket.id )
			sendState( socket )
		}
		const dispatchListener = ( remoteAction, callback ) => {
			const action = {
				type: REMOTE_ACTION_TYPE,
				action: assoc( REMOTE_USER_KEY, user, remoteAction ),
				socketId: socket.id,
				user
			}
			if ( ! canRemoteDispatch( action, getState ) ) {
				log( 'remote dispatch not allowed for action', remoteAction.type )
				callback( 'Remote dispatch not allowed' )
				return
			}
			dispatch( action )
			callback()
		}
		socket.on( 'broadcast.state', stateListener )
		socket.on( 'broadcast.dispatch', dispatchListener )
		socket.once( 'disconnect', () => {
			socket.removeListener( 'broadcast.state', stateListener )
			socket.removeListener( 'broadcast.dispatch', dispatchListener )
		} )
	}

	const handleOperatorReady = action => {
		join( io, action.socket )
			.catch( e => debug( 'Failed to add user socket to broadcast', action.user.id, e.message ) )
		listen( action.socket, action.user )
		sendState( action.socket )
	}

	const update = debounce( broadcastChange, 20, { maxTime: 200 } )

	return {
		initializeUserSocket: ( user, socket ) => handleOperatorReady( { user, socket } ),
		onDispatch: next => action => {
			switch ( action.type ) {
				case REMOTE_ACTION_TYPE:
					debug( 'apply remote action to %s', action.socketId )
					// authentication happenned at the node, just dispatch the action
					const remote = action.action
					dispatch( remote )
					return action;
				case BROADCAST_REQUEST_STATE:
					debug( 'broadcast state to socket %s', action.socketId )
					io.to( action.socketId ).emit( 'broadcast.state', version, currentState )
					return null;
			}
			if ( ! shouldBroadcastStateChange( action ) ) {
				return next( action )
			}

			const result = next( action )
			update( getState() )
			return result
		}
	}
}
