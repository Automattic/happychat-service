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
import once from 'lodash/once'

import reducer, {
	selectIdentities,
	selectSocketIdentity,
	selectTotalCapacity,
	selectUser,
	updateAvailability,
	incrementLoad,
	decrementLoad
} from './store'
import { createStore, applyMiddleware } from 'redux'

import operatorMiddleware from '../middlewares/operators'

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
		const callback = once( complete )
		withTimeout( ( cancel ) => {
			const socket = io.connected[socket_id]
			socket.emit( 'available', chat, ( available ) => {
				callback( null, assign( { socket }, available ) )
				cancel()
			} )
		}, () => callback( null, { capacity: 0, load: 0 } ) )
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
	parallel( map( clients, ( client_id ) => ( callback ) => {
		const client = io.connected[client_id]
		const complete = once( callback )
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

const assignChat = ( { io, operator, chat, room, events } ) => new Promise( ( resolve, reject ) => {
	// send the event to the operator and confirm that the chat was opened
	// TODO: timeouts? only one should have to succeed or should all of them have
	// to succeed?
	debug( 'assigning chat to operator')
	operatorClients( { io, operator } )
	.then( openChatForClients( { io, events, operator, room, chat } ) )
	.then( () => {
		emitInChat( { io, events, chat } )
		resolve( operator )
	}, reject )
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
	const store = createStore( reducer(), applyMiddleware(
		operatorMiddleware( io, events )
	) );
	const emitOnline = throttle( users => {
		io.emit( 'operators.online', users )
		events.emit( 'available', users )
	}, 100 )

	const selectIdentity = userId => selectUser( store.getState(), userId )
	const getIdentities = () => selectIdentities( store.getState() )

	store.subscribe( () => emitOnline( getIdentities() ) )

	events.io = io

	events.on( 'receive', ( { id }, message ) => {
		io.in( customerRoom( id ) ).emit( 'chat.message', { id }, message )
	} )

	events.on( 'receive.typing', ( chat, user, text ) => {
		const { id } = chat
		io.in( customerRoom( id ) ).emit( 'chat.typing', chat, user, text )
	} )

	events.on( 'transfer', ( chat, from, to, complete ) => {
		debug( 'transferring', chat, from, to )
		const toUser = selectUser( store.getState(), to.id )
		const room = `customers/${ chat.id }`
		// TODO: test for user availability
		assignChat( { io, operator: toUser, chat, room, events } )
		.then(
			() => {
				store.dispatch( incrementLoad( toUser ) );
				if ( from ) {
					const fromUser = selectUser( store.getState(), from.id )
					store.dispatch( decrementLoad( fromUser ) );
				}
				return complete( null, toUser.id )
			},
			e => debug( 'failed to assign transfered chat', e )
		)
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
			store.dispatch( incrementLoad( user, chats.length ) )
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
		store.dispatch( decrementLoad( operator ) )
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

	return events
}
