import jsondiff from 'simperium-jsondiff'
import { v4 as uuid } from 'uuid'
import { debounce } from 'lodash'
import { REMOTE_ACTION_TYPE } from './state/action-types'
import { isEmpty, assoc, evolve, filter, compose, not, equals, keys, contains } from 'ramda'

import canRemoteDispatch from './state/operator/can-remote-dispatch'
import { STATUS_CLOSED, statusView } from './state/chatlist/reducer'
import { getSocketOperator } from './state/operator/selectors'

const debug = require( 'debug' )( 'happychat-debug:socket-io:broadcast' )
const log = require( 'debug' )( 'happychat:socket-io:broadcast' )

export const REMOTE_USER_KEY = 'REMOTE_USER'

const filterClosed = filter( compose(
	not,
	equals( STATUS_CLOSED ),
	statusView,
) )

const broadcastVersion = ( io, version, nextVersion, patch ) => {
	debug( 'broadcasting version %s', version )
	// TODO, only broadcast to the local clients to this Socket.IO node
	// a bit of a hack, this state is only relevant to the clients connected
	// directly to this server

	io.in( 'authorized' ).clients( ( e, ids ) => {
		const connected = keys( io.connected )
		const local = filter( id => contains( id, connected ), ids )
		for ( let id of local ) {
			io.to( id )
		}
		debug( 'broadcasting to', local )
		io.emit( 'broadcast.update', version, nextVersion, patch )
	} )
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

const selector = evolve( { chatlist: filterClosed } )

export default ( store, io ) => {
	const { getState, dispatch } = store
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

	const update = debounce( broadcastChange, 20, { maxTime: 200 } )

	io.on( 'connection', socket => {
		socket.on( 'broadcast.dispatch', ( remoteAction, callback ) => {
			const user = getSocketOperator( socket, getState() )
			// when no operator is associated with the socket callback with string of failure reason
			if ( !user ) {
				debug( 'callback not authorized' )
				return callback( 'socket not authorized' )
			}

			const request = {
				type: REMOTE_ACTION_TYPE,
				action: assoc( REMOTE_USER_KEY, user, remoteAction ),
				socketId: socket.id,
				user
			}
			if ( ! canRemoteDispatch( request, getState() ) ) {
				log( 'remote dispatch not allowed for action', remoteAction.type )
				callback( 'Remote dispatch not allowed' )
				return
			}
			debug( 'dispatching', request.action.type )
			dispatch( request.action )
			callback()
		} )
		socket.on( 'broadcast.state', () => {
			const user = getSocketOperator( socket, getState() )
			if ( ! user ) {
				// only sockets with associated operators can request state
				return
			}
			debug( 'state requested' )
			socket.emit( 'broadcast.state', version, currentState )
		} )
	} )

	store.subscribe( () => update( getState() ) )
}
