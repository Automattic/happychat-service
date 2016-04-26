import EventEmitter from 'events'
import { onConnection, timestamp } from './util'
import { parallel } from 'async'
import { isEmpty } from 'lodash/lang'
import { set, assign, values } from 'lodash/object'
import { throttle } from 'lodash/function'
import { map, forEach, reduce } from 'lodash/collection'

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

const identityForUser = ( { id, displayName, avatarURL } ) => (
	{ id, displayName, avatarURL }
)

const queryClients = ( io, room ) => new Promise( ( resolve, reject ) => {
	io.in( room ).clients( ( error, clients ) => {
		if ( error ) {
			return reject( error )
		}
		resolve( clients )
	} )
} )

const online = ( io ) => queryClients( io, 'online' )

const queryAvailability = ( chat, clients, io ) => new Promise( ( resolve, reject ) => {
	if ( isEmpty( clients ) ) {
		return reject( new Error( 'no operators connected' ) )
	}

	parallel( clients.map( ( socket_id ) => ( complete ) => {
		withTimeout( ( cancel ) => {
			const socket = io.connected[socket_id]
			socket.emit( 'available', chat, ( available ) => {
				complete( null, assign( { socket }, available ) )
				cancel()
			} )
		}, () => complete( null, { capacity: 0, load: 0 } ) )
	} ), ( error, results ) => {
		if ( error ) {
			return reject( error )
		}
		resolve( results )
	} )
} )

const pickAvailable = ( availability ) => new Promise( ( resolve, reject ) => {
	const operator = availability
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
		return reject( new Error( 'no operators available' ) )
	}

	if ( !operator.id ) {
		return reject( new Error( 'invalid operator' ) )
	}

	resolve( operator )
} )

const queryOnline = ( io, timeout ) => online( io ).then( ( clients ) => new Promise( ( resolve, reject ) => {
	parallel( map( clients, ( client_id ) => ( complete ) => {
		const client = io.connected[client_id]
		withTimeout( ( cancel ) => {
			if ( !client ) {
				cancel()
				return complete( null, null )
			}
			client.emit( 'identify', ( identity ) => {
				cancel()
				complete( null, identity )
			} )
		}, () => complete( null, null ), timeout )
	} ), ( error, results ) => {
		if ( error ) {
			return reject( error )
		}
		resolve( results )
	} )
} ) )

const reduceUniqueOperators = ( operators ) => values( reduce( operators, ( unique, operator ) => {
	if ( isEmpty( operator ) ) {
		return unique
	}
	return set( unique, operator.id, operator )
}, {} ) )

const all = ( ... fns ) => ( ... args ) => forEach( fns, ( fn ) => fn( ... args ) )

const emitOnline = throttle( ( io ) => {
	// when a socket disconnects, query the online room for connected operators
	queryOnline( io ).then( ( identities ) => {
		io.emit( 'operators.online', reduceUniqueOperators( identities ) )
	} )
	.catch( ( e ) => debug( 'failed to query online', e, e.stack ) )
}, 100 )

const join = ( { socket, events, user, io } ) => {
	const user_room = `operators/${user.id}`
	debug( 'initialize the operator', user )

	socket.on( 'status', ( status, done ) => {
		// TODO: if operator has multiple clients, move all of them?
		if ( status === 'online' ) {
			debug( 'joining room', 'online' )
			socket.join( 'online', all( done, () => emitOnline( io ) ) )
		} else {
			socket.leave( 'online', all( done, () => emitOnline( io ) ) )
		}
	} )

	socket.on( 'disconnect', () => {
		emitOnline( io )
		io.in( user_room ).clients( ( error, clients ) => {
			debug( 'clients?', clients.length )
			events.emit( 'leave', user )
		} )
	} )

	socket.join( user_room, () => {
		socket.emit( 'init', user )
		events.emit( 'init', { user, socket, room: user_room } )
	} )

	socket.on( 'message', ( chat_id, { id, text } ) => {
		const meta = {}
		const userIdentity = identityForUser( user )
		const message = { id: id, text, timestamp: timestamp(), user: userIdentity, meta }
		// all customer connections for this user receive the message
		debug( 'broadcasting message', user.id, id, message )
		events.emit( 'message', { id: chat_id }, user, message )
	} )
}

const operatorClients = ( { io, operator } ) => new Promise( ( resolve, reject ) => {
	const room = `operators/${ operator.id }`
	io.in( room ).clients( ( error, clients ) => {
		if ( error ) reject( error )
		resolve( map( clients ), ( socketid ) => io.connected[socketid] )
	} )
} )

const assignChat = ( { io, operator, chat, room } ) => new Promise( ( resolve, reject ) => {
	const operator_room_name = `operators/${operator.id}`
	// send the event to the operator and confirm that the chat was opened
	// TODO: timeouts? only one should have to succeed or should all of them have to succeed?
	operatorClients( { io, operator } )
	.then( ( clients ) => {
		parallel( clients.map( ( socketid ) => ( complete ) => {
			io.connected[socketid].join( room, complete )
		} ), ( e ) => {
			if ( e ) {
				reject( e )
			}
			debug( 'Assigning chat: (chat.open)', chat )
			io.in( operator_room_name ).emit( 'chat.open', chat )
			resolve( operator )
		} )
	} )
} )

export default ( io ) => {
	const events = new EventEmitter()

	events.io = io

	events.on( 'receive', ( { id }, message ) => {
		const room_name = `customers/${ id }`
		io.in( room_name ).emit( 'chat.message', { id }, message )
	} )

	events.on( 'recover', ( { user }, chats, callback ) => {
		parallel( map( chats, ( chat ) => ( complete ) => {
			const room = `customers/${ chat.id }`
			debug( 'Recover chats: ', room )
			assignChat( { io, operator: user, chat, room } ).then( () => complete( null ), complete )
		} ), ( e ) => {
			if ( e ) {
				debug( 'failed to recover chats', e )
				return
			}
			callback()
		} )
	} )

	events.on( 'assign', ( chat, room, callback ) => {
		// find an operator
		debug( 'find an operator for', chat.id )
		online( io )
		.then( ( clients ) => queryAvailability( chat, clients, io ) )
		.then( pickAvailable )
		.then( ( operator ) => assignChat( { io, operator, chat, room } ) )
		.then( ( operator ) => callback( null, operator ) )
		.catch( callback )
	} )

	io.on( 'connection', ( socket ) => {
		debug( 'operator connecting' )
		onConnection( { socket, events } )( ( user ) => join( { socket, events, user, io } ) )
	} )

	return events
}
