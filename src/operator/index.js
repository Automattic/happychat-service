import { parallel } from 'async'
import isEmpty from 'lodash/isEmpty'
import set from 'lodash/set'
import values from 'lodash/values'
import throttle from 'lodash/throttle'
import map from 'lodash/map'
import reduce from 'lodash/reduce'

import {
	selectIdentities,
	selectSocketIdentity,
	selectUser
} from './store'

import {
	updateAvailability,
	operatorReceive,
	operatorChatOnline,
	operatorIdentifyClientRequest,
	operatorClientQuery,
	clientQuery,
	operatorOpenChatForClients,
	operatorLeaveChat,
	operatorQueryAvailability
} from './actions';

export const STATUS_AVAILABLE = 'available';

const debug = require( 'debug' )( 'happychat:operator' )

const queryClients = ( store, room ) => new Promise( ( resolve, reject ) => {
	store.dispatch( clientQuery( room, { resolve, reject } ) )
} )

const allClients = ( store ) => queryClients( store )

const queryAvailability = ( chat, clients, store ) => new Promise( ( resolve, reject ) => {
	store.dispatch( operatorQueryAvailability( clients, chat, { resolve, reject } ) );
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

const identifyClients = ( store, timeout ) => ( clients ) => new Promise( ( resolve, reject ) => {
	store.dispatch( operatorIdentifyClientRequest( clients, timeout, { resolve, reject } ) )
} )

const reduceUniqueOperators = ( operators ) => values( reduce( operators, ( unique, operator ) => {
	if ( isEmpty( operator ) ) {
		return unique
	}
	return set( unique, operator.id, operator )
}, {} ) )

const emitInChat = throttle( ( { store, chat } ) => {
	const room = `customers/${chat.id}`
	debug( 'querying operators in chat', chat, room )
	queryClients( store, room )
	.then( identifyClients( store ) )
	.then( reduceUniqueOperators )
	.then( ( identities ) => {
		debug( 'sending chat.online', chat, identities )
		store.dispatch( operatorChatOnline( chat.id, identities ) );
	} )
} )

const operatorClients = ( { store, operator } ) => new Promise( ( resolve, reject ) => {
	store.dispatch( operatorClientQuery( operator.id, { resolve, reject } ) );
} )

const openChatForClients = ( { store, events, operator, room, chat } ) => ( clients ) => new Promise( ( resolve, reject ) => {
	const onDisconnect = emitInChat.bind( undefined, { store, events, chat } );
	const deferred = { resolve, reject };
	store.dispatch( operatorOpenChatForClients( operator, clients, room, chat, deferred, onDisconnect ) );
} )

// on response of all connected clients
// forEach client dispatch add client to room
//   on add emit join (what does this do?)
//   on add, add disconnect listener to dispatch emitInChat
// finallly dispatch chat.open in operator room

const assignChat = ( { store, operator, chat, room, events } ) => new Promise( ( resolve, reject ) => {
	// send the event to the operator and confirm that the chat was opened
	// TODO: timeouts? only one should have to succeed or should all of them have
	// to succeed?
	debug( 'assigning chat to operator' )
	operatorClients( { store, operator } )
	.then( openChatForClients( { store, events, operator, room, chat } ) )
	.then( () => {
		emitInChat( { store, events, chat } )
		resolve( operator )
	}, reject )
} )

const leaveChat = ( { store, operator, chat, room, events } ) => {
	debug( 'time to leave', operator )
	const operator_room_name = `operators/${operator.id}`
	operatorClients( { store, operator } )
	.then( ( clients ) => new Promise( ( resolve, reject ) => {
		const deferred = { resolve, reject };
		store.dispatch( operatorLeaveChat( clients, room, operator_room_name, chat, deferred ) )
	} ) )
	.then( () => {
		debug( 'emit in chat now' )
		emitInChat( { store, events, chat } )
	} )
}

export default ( io, events, store ) => {

	const getIdentities = () => selectIdentities( store.getState() )

	events.io = io
	events.store = store

	events.on( 'transfer', ( chat, from, to, complete ) => {
		debug( 'transferring', chat, from, to )
		const toUser = selectUser( store.getState(), to.id )
		const room = `customers/${ chat.id }`
		// TODO: test for user availability
		assignChat( { store, operator: toUser, chat, room, events } )
		.then(
			() => complete( null, toUser.id ),
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
			assignChat( { operator: user, chat, room, events } )
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
			assignChat( { store, operator: user, chat, room, events } ).then( () => complete( null ), complete )
		} ), ( e ) => {
			if ( e ) {
				debug( 'failed to recover chats', e )
				return
			}
			callback()
		} )
	} )

	events.on( 'open', ( chat, room, operator ) => {
		const operator_room_name = `operators/${operator.id}`
		debug( 'open chat for operator', chat, operator, operator_room_name )
		assignChat( { store, operator, chat, room, events } )
		.then( () => {
			debug( 'operator joined chat', operator, chat )
			store.dispatch( operatorReceive( chat.id ) );
		} )
		.catch( ( e ) => {
			debug( 'failed to join chat', e )
		} )
	} )

	events.on( 'leave', ( chat, room, operator ) => {
		leaveChat( { store, operator, chat, room, events } )
	} )

	// Assigning a new chat to an available operator
	events.on( 'assign', ( chat, room, callback ) => {
		// find an operator
		debug( 'find an operator for', chat.id )
		allClients( store )
		.then( clients => queryAvailability( chat, clients, store ) )
		.then( cacheAvailability( store ) )
		.then( pickAvailable( socket => selectSocketIdentity( store.getState(), socket ) ) )
		.then( operator => {
			debug( 'assigning chat to ', operator )
			return assignChat( { store, operator, chat, room, events } )
		} )
		.then( operator => callback( null, operator ) )
		.catch( e => {
			debug( 'failed to find operator', e )
			callback( e )
		} )
	} )

	events.on( 'identities', ( callback ) => {
		debug( 'on.identities' )
		callback( getIdentities() )
	} )

	return events
}
