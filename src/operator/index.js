import EventEmitter from 'events'
import { onConnection, timestamp } from '../util'
import { parallel } from 'async'
import isEmpty from 'lodash/isEmpty'
import set from 'lodash/set'
import assign from 'lodash/assign'
import values from 'lodash/values'
import throttle from 'lodash/throttle'
import map from 'lodash/map'
import reduce from 'lodash/reduce'

import reducer, {
	updateIdentity,
	removeUser,
	removeUserSocket,
	selectIdentities,
	selectSocketIdentity,
	selectTotalCapacity,
	selectUser,
	updateUserStatus,
	updateCapacity,
	updateAvailability,
	incrementLoad,
	decrementLoad
} from './store'
import { createStore } from 'redux'

const DEFAULT_TIMEOUT = 1000
const STATUS_AVAILABLE = 'available';

const debug = require( 'debug' )( 'happychat:operator' )
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

const customerRoom = id => `customers/${ id }`

const queryClients = ( io, room ) => new Promise( ( resolve, reject ) => {
	const onClients = ( error, clients ) => {
		if ( error ) {
			return reject( error )
		}
		resolve( clients )
	}
	if ( room ) {
		io.in( room ).clients( onClients )
	} else {
		io.clients( onClients )
	}
} )

const allClients = ( io ) => queryClients( io )

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

const cacheAvailability = ( store ) => ( availability ) => {
	store.dispatch( updateAvailability( availability ) )
	return availability;
}

const pickAvailable = ( selectIdentity ) => ( availability ) => new Promise( ( resolve, reject ) => {
	const [ operator ] = availability
	.filter( ( op ) => {
		if ( op.status !== STATUS_AVAILABLE ) {
			return false;
		}
		return op.capacity - op.load > 0
	} )
	.sort( ( a, b ) => {
		const a_weight = ( a.capacity - a.load ) / a.capacity
		const b_weight = ( b.capacity - b.load ) / b.capacity
		if ( a_weight === b_weight ) return a.capacity > b.capacity ? -1 : 1
		return ( a_weight > b_weight ? -1 : 1 )
	} )

	if ( !operator ) {
		return reject( new Error( 'no operators available' ) )
	}

	if ( !operator.socket ) {
		return reject( new Error( 'invalid operator' ) )
	}

	resolve( selectIdentity( operator.socket ) )
} )

const identifyClients = ( io, timeout ) => ( clients ) => new Promise( ( resolve, reject ) => {
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
} )

const reduceUniqueOperators = ( operators ) => values( reduce( operators, ( unique, operator ) => {
	if ( isEmpty( operator ) ) {
		return unique
	}
	return set( unique, operator.id, operator )
}, {} ) )

const emitInChat = throttle( ( { io, chat } ) => {
	const room = `customers/${chat.id}`
	debug( 'querying operators in chat', chat, room )
	queryClients( io, room )
	.then( identifyClients( io ) )
	.then( ( operators ) => Promise.resolve( reduceUniqueOperators( operators ) ) )
	.then( ( identities ) => {
		debug( 'sending chat.online', chat, identities )
		io.in( room ).emit( 'chat.online', chat.id, identities )
	} )
} )

const join = ( { socket, events, user, io, selectIdentity } ) => {
	debug( 'initialize the operator', user )
	const user_room = `operators/${user.id}`
	socket.on( 'status', ( status, done ) => {
		// TODO: if operator has multiple clients, move all of them?
		const updateStatus = ( e ) => {
			events.emit( 'status', user, status )
			done( e )
		}

		if ( status === 'online' ) {
			debug( 'joining room', 'online' )
			socket.join( 'online', updateStatus )
		} else {
			socket.leave( 'online', updateStatus )
		}
	} )

	socket.on( 'capacity', ( capacity, done ) => {
		events.emit( 'capacity', user, capacity );
		done( capacity );
	} )

	socket.on( 'disconnect', () => {
		// emitOnline( { io, events } )
		events.emit( 'disconnect-socket', { user, socket } )
		io.in( user_room ).clients( ( error, clients ) => {
			if ( error ) {
				debug( 'failed to query clients', error )
				return;
			}
			if ( clients.length > 0 ) {
				return;
			}
			events.emit( 'disconnect', user )
		} )
	} )

	socket.join( user_room, () => {
		socket.emit( 'init', user )
		events.emit( 'init', { user, socket, room: user_room } )
	} )

	socket.on( 'message', ( chat_id, { id, text } ) => {
		const meta = {}
		const userIdentity = identityForUser( user )
		const message = { id: id, session_id: chat_id, text, timestamp: timestamp(), user: userIdentity, meta }
		// all customer connections for this user receive the message
		debug( 'broadcasting message', user.id, id, message )
		events.emit( 'message', { id: chat_id }, user, message )
	} )

	socket.on( 'chat.typing', ( chat_id, text ) => {
		const userIdentity = identityForUser( user )
		debug( 'received operator `typing` event', userIdentity.id, chat_id, text );

		events.emit( 'typing', { id: chat_id }, userIdentity, text );
	} )

	socket.on( 'chat.join', ( chat_id ) => {
		debug( 'client requesting to join', chat_id )
		events.emit( 'chat.join', chat_id, user )
	} )

	socket.on( 'chat.leave', ( chat_id ) => {
		events.emit( 'chat.leave', chat_id, user )
	} )

	socket.on( 'chat.close', ( chat_id ) => {
		events.emit( 'chat.close', chat_id, user )
	} )

	socket.on( 'chat.transfer', ( chat_id, user_id ) => {
		const toUser = selectIdentity( user_id )
		events.emit( 'chat.transfer', chat_id, user, toUser )
	} )
}

const operatorClients = ( { io, operator } ) => new Promise( ( resolve, reject ) => {
	const room = `operators/${ operator.id }`
	io.in( room ).clients( ( error, clients ) => {
		if ( error ) reject( error )
		resolve( map( clients, ( socketid ) => io.connected[socketid] ) )
	} )
} )

const openChatForClients = ( { io, events, operator, room, chat } ) => ( clients ) => new Promise( ( resolve, reject ) => {
	const operator_room_name = `operators/${operator.id}`
	parallel( map( clients, ( socket ) => ( complete ) => {
		socket.join( room, ( error ) => {
			// a socket has joined
			debug( 'chat was opened', room )
			events.emit( 'join', chat, operator, socket )
			complete( error )
			socket.on( 'disconnect', () => emitInChat( { io, events, chat } ) )
		} )
	} ), ( e ) => {
		if ( e ) {
			return reject( e )
		}
		debug( 'Assigning chat: (chat.open)', chat, operator_room_name )
		io.in( operator_room_name ).emit( 'chat.open', chat )
		resolve( clients )
	} )
} )

const assignChat = ( { io, operator, chat, room, events } ) => new Promise( ( resolve ) => {
	// send the event to the operator and confirm that the chat was opened
	// TODO: timeouts? only one should have to succeed or should all of them have
	// to succeed?
	operatorClients( { io, operator } )
	.then( openChatForClients( { io, events, operator, room, chat } ) )
	.then( () => {
		emitInChat( { io, events, chat } )
		resolve( operator )
	} )
} )

const leaveChat = ( { io, operator, chat, room, events } ) => {
	debug( 'time to leave', operator )
	const operator_room_name = `operators/${operator.id}`
	operatorClients( { io, operator } )
	.then( ( clients ) => new Promise( ( resolve, reject ) => {
		parallel( map( clients, socket => callback => {
			socket.leave( room, error => callback( error, socket ) )
		} ), e => {
			if ( e ) return reject( e )
			io.in( operator_room_name ).emit( 'chat.leave', chat )
			resolve( clients )
		} )
	} ) )
	.then( () => {
		debug( 'emit in chat now' )
		emitInChat( { io, events, chat } )
	} )
}

export default io => {
	const events = new EventEmitter()
	const store = createStore( reducer() )
	const emitOnline = throttle( users => {
		io.emit( 'operators.online', users )
		events.emit( 'available', users )
	}, 100 )

	const selectIdentity = userId => selectUser( store.getState(), userId )
	const getIdentities = () => selectIdentities( store.getState() )

	store.subscribe( () => emitOnline( getIdentities() ) )

	events.io = io

	events.on( 'init', ( { socket, user } ) => {
		store.dispatch( updateIdentity( socket, user ) )
	} )

	events.on( 'disconnect-socket', ( { socket, user } ) => {
		store.dispatch( removeUserSocket( socket, user ) )
	} )

	events.on( 'disconnect', ( user ) => {
		store.dispatch( removeUser( user ) )
	} )

	events.on( 'receive', ( { id }, message ) => {
		io.in( customerRoom( id ) ).emit( 'chat.message', { id }, message )
	} )

	events.on( 'receive.typing', ( chat, user, text ) => {
		const { id } = chat
		io.in( customerRoom( id ) ).emit( 'chat.typing', chat, user, text )
	} )

	events.on( 'status', ( user, status ) => {
		store.dispatch( updateUserStatus( user, status ) )
	} )

	events.on( 'capacity', ( user, capacity ) => {
		store.dispatch( updateCapacity( user, capacity ) )
	} )

	events.on( 'transfer', ( chat, from, to, complete ) => {
		debug( 'transferring', chat, from, to );
		const fromUser = selectUser( store.getState(), from.id )
		const toUser = selectUser( store.getState(), to.id )
		const room = `customers/${ chat.id }`
		// TODO: test for user availability
		assignChat( { io, operator: toUser, chat, room, events } )
		.then( () => {
			store.dispatch( incrementLoad( toUser ) );
			store.dispatch( decrementLoad( fromUser ) );
			return complete( null, toUser.id )
		} )
	} )

	// additional operator socket came online
	// assign all of the existing operator chats
	// for now just broadcast to all operator connections
	events.on( 'reassign', ( user, socket, chats ) => {
		debug( 'REASSIGNING', user, chats )
		map( chats, ( chat ) => {
			const room = `customers/${ chat.id }`
			debug( 'reassigning chat', user, chat )
			assignChat( { io, operator: user, chat, room, events } )
			.then( () => {
				debug( 'opened chat for operator:', user.id )
			} )
		} )
	} )

	// operator had completely disconnected so chats were abandoned
	events.on( 'recover', ( { user }, chats, callback ) => {
		parallel( map( chats, ( chat ) => ( complete ) => {
			const room = `customers/${ chat.id }`
			debug( 'Recover chats: ', room, chat )
			assignChat( { io, operator: user, chat, room, events } ).then( () => complete( null ), complete )
		} ), ( e ) => {
			if ( e ) {
				debug( 'failed to recover chats', e )
				return
			}
			store.dispatch( incrementLoad( user ) )
			callback()
		} )
	} )

	events.on( 'open', ( chat, room, operator ) => {
		const operator_room_name = `operators/${operator.id}`
		debug( 'open chat for operator', chat, operator, operator_room_name )
		assignChat( { io, operator, chat, room, events } )
		.then( () => {
			debug( 'operator joined chat', operator, chat )
			events.emit( 'receive', chat, {} )
		} )
		.catch( ( e ) => {
			debug( 'failed to join chat', e )
		} )
	} )

	events.on( 'close', ( chat, room, operator ) => {
		io.in( room ).emit( 'chat.close', chat, operator )
		store.dispatch( decrementLoad( operator ) )
	} )

	events.on( 'leave', ( chat, room, operator ) => {
		leaveChat( { io, operator, chat, room, events } )
	} )

	// Assigning a new chat to an available operator
	events.on( 'assign', ( chat, room, callback ) => {
		// find an operator
		debug( 'find an operator for', chat.id )
		allClients( io )
		.then( clients => queryAvailability( chat, clients, io ) )
		.then( cacheAvailability( store ) )
		.then( pickAvailable( socket => selectSocketIdentity( store.getState(), socket ) ) )
		.then( operator => {
			debug( 'assigning chat to ', operator )
			store.dispatch( incrementLoad( operator ) );
			return assignChat( { io, operator, chat, room, events } )
		} )
		.then( operator => callback( null, operator ) )
		.catch( e => {
			debug( 'failed to find operator', e )
			callback( e )
		} )
	} )

	// respond if operators are willing to handle new customer connection
	events.on( 'accept', ( chat, callback ) => {
		const { load, capacity } = selectTotalCapacity( store.getState(), STATUS_AVAILABLE )
		callback( null, capacity > load )
	} )

	events.on( 'identities', ( callback ) => {
		debug( 'on.identities' )
		callback( getIdentities() )
	} )

	io.on( 'connection', ( socket ) => {
		debug( 'operator connecting' )
		onConnection( { socket, events } )(
			user => join( { socket, events, user, io, selectIdentity } )
		)
	} )

	return events
}
