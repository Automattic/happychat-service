import EventEmitter from 'events'
import { onConnection } from './util'
import { parallel } from 'async'
import { isEmpty } from 'lodash/lang'
import { assign } from 'lodash/object'

const DEFAULT_TIMEOUT = 1000

const debug = require( 'debug' )( 'tinkerchat:operator' )
const throwTimeout = () => {
	throw new Error( 'Operation timed out' )
}

const withTimeout = ( fn, onError = throwTimeout, ms = DEFAULT_TIMEOUT ) => {
	const timeout = setTimeout( onError, ms )
	debug( 'calling with timeout', ms )
	fn( () => clearTimeout( timeout ) )
}

const join = ( { socket, events, user, io } ) => {
	// TODO: initialize the agent
	debug( 'initialize the operator', user )
	socket.on( 'status', ( status, done ) => {
		debug( 'set operator status', status )
		if ( status === 'online' ) {
			debug( 'joining room', 'online' )
			socket.join( 'online', done )
		} else {
			socket.leave( 'online', done )
		}
	} )
	socket.join( `operators/${user.id}`, () => {
		socket.emit( 'init', user )
	} )

	socket.on( 'disconnect', () => {
		debug( 'goodbye!', socket.rooms )
	} )
}

export default ( io ) => {
	const events = new EventEmitter()

	events.io = io

	events.on( 'assign', ( chat, callback ) => {
		// find an operator
		debug( 'find an operator for', chat.id )
		const room_name = `customers/${ chat.id }`
		io.in( 'online' ).clients( ( error, clients ) => {
			if ( error ) {
				return callback( error )
			}
			debug( 'online: ', clients.length )

			const ifNotAvailable = () => callback( new Error( 'no clients available' ) )
			// if there are no clients available emit error
			if ( isEmpty( clients ) ) {
				return ifNotAvailable()
			}

			// iterate each socket and see if there are any available?
			parallel( clients.map( ( socket_id ) => ( complete ) => {
				const socket = io.connected[socket_id]
				debug( 'asking', socket_id )
				withTimeout( ( cancel ) => {
					socket.emit( 'available', chat, ( available ) => {
						complete( null, assign( { socket }, available ) )
						cancel()
					} )
				}, () => complete( null, { capacity: 0, load: 0 } ) )
			} ), ( error, results ) => {
				if ( error ) {
					return ifNotAvailable()
				}
				if ( isEmpty( results ) ) {
					return ifNotAvailable()
				}

				// pick the first socket with the most space and least load
				const operator = results
				.filter( ( op ) => op.capacity - op.load > 0 )
				.sort( ( a, b ) => {
					const a_open = a.capacity - a.load
					const b_open = b.capacity - b.load
					if ( a_open === b_open ) return 0
					return ( a_open > b_open ? -1 : 1 )
				} )
				.sort( ( a, b ) => {
					if ( a.load === b.load ) {
						return 0
					}
					return a.load < b.load ? -1 : 1
				} )[0]

				if ( !operator ) {
					return ifNotAvailable()
				}

				if ( !operator.id ) {
					return ifNotAvailable()
				}

				const operator_room_name = `operators/${operator.id}`
				// send the event to the operator and confirm that the chat was opened
				io.in( operator_room_name ).clients( ( error, clients ) => {
					parallel( clients.map( ( socketid ) => ( complete ) => {
						io.connected[socketid].join( room_name, complete )
					} ), ( e ) => {
						io.in( operator_room_name ).emit( 'chat.open', chat )
						callback( null, operator )
					} )
				} )
			} )
		} )
	} )

	io.on( 'connection', ( socket ) => {
		debug( 'operator connecting' )
		onConnection( { socket, events } )( ( user ) => join( { socket, events, user, io } ) )
	} )

	return events
}
