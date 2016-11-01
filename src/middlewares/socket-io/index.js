import { parallel } from 'async'
import map from 'lodash/map'
import once from 'lodash/once'
import isEmpty from 'lodash/isEmpty'
import assign from 'lodash/assign'
import throttle from 'lodash/throttle'

import { onConnection, timestamp } from '../../util'
import {
	REMOVE_USER,
	OPERATOR_RECEIVE,
	OPERATOR_RECEIVE_TYPING,
	OPERATOR_CHAT_ONLINE,
	OPERATOR_IDENTIFY_CLIENT_REQUEST,
	CLIENT_QUERY,
	OPERATOR_CLIENT_QUERY,
	OPERATOR_OPEN_CHAT_FOR_CLIENTS,
	OPERATOR_LEAVE_CHAT,
	OPERATOR_CLOSE_CHAT,
	OPERATOR_QUERY_AVAILABILITY,
	updateUserStatus,
	updateCapacity,
	removeUserSocket,
	removeUser,
	updateIdentity
} from '../../operator/actions';

import {
	selectUser,
	selectIdentities
} from '../../operator/store';

const debug = require( 'debug' )( 'happychat:middleware:operators' )

const DEFAULT_TIMEOUT = 1000

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

const customerRoom = id => `customers/${ id }`;

const OPERATOR_MESSAGE = 'OPERATOR_MESSAGE';
const operatorMessage = ( id, user, message ) => (
	{ type: OPERATOR_MESSAGE, id, user, message }
)

const OPERATOR_TYPING = 'OPERATOR_TYPING';
const operatorTyping = ( id, userIdentity, text ) => (
	{ type: OPERATOR_TYPING, id, userIdentity, text }
)

const OPERATOR_CHAT_JOIN = 'OPERATOR_CHAT_JOIN';
const operatorChatJoin = ( chat_id, user ) => (
	{ type: OPERATOR_CHAT_JOIN, chat_id, user }
)

const OPERATOR_CHAT_LEAVE = 'OPERATOR_CHAT_LEAVE';
const operatorChatLeave = ( chat_id, user ) => (
	{ type: OPERATOR_CHAT_LEAVE, chat_id, user }
)

const OPERATOR_CHAT_CLOSE = 'OPERATOR_CHAT_CLOSE';
const operatorChatClose = ( chat_id, user ) => (
	{ type: OPERATOR_CHAT_CLOSE, chat_id, user }
)

const OPERATOR_CHAT_TRANSFER = 'OPERATOR_CHAT_TRANSFER';
const operatorChatTransfer = ( chat_id, user, toUser ) => (
	{ type: OPERATOR_CHAT_TRANSFER, chat_id, user, toUser }
)

export const OPERATOR_READY = 'OPERATOR_READY'
const operatorReady = ( user, socket, room ) => (
	{ type: OPERATOR_READY, user, socket, room }
);

const join = ( { socket, store, user, io } ) => {
	debug( 'initialize the operator', user )

	const user_room = `operators/${user.id}`

	const selectIdentity = userId => selectUser( store.getState(), userId );

	socket.on( 'status', ( status, done ) => {
		store.dispatch( updateUserStatus( user, status ) );
		// events.emit( 'status', user, status )
		done()
	} )

	socket.on( 'capacity', ( capacity, done ) => {
		store.dispatch( updateCapacity( user, capacity ) )
		done( capacity );
	} )

	socket.on( 'disconnect', () => {
		// events.emit( 'disconnect-socket', { user, socket } )
		store.dispatch( removeUserSocket( socket, user ) );
		io.in( user_room ).clients( ( error, clients ) => {
			if ( error ) {
				debug( 'failed to query clients', error )
				return;
			}
			if ( clients.length > 0 ) {
				return;
			}
			store.dispatch( removeUser( user ) ) // thunk?
		} )
	} )

	socket.join( user_room, () => {
		socket.emit( 'init', user )
		store.dispatch( updateIdentity( socket, user ) )
		store.dispatch( operatorReady( user, socket, user_room ) )
	} )

	socket.on( 'message', ( chat_id, { id, text } ) => {
		const meta = {}
		const userIdentity = identityForUser( user )
		const message = { id: id, session_id: chat_id, text, timestamp: timestamp(), user: userIdentity, meta }
		// all customer connections for this user receive the message
		debug( 'broadcasting message', user.id, id, message )
		store.dispatch( operatorMessage( chat_id, user, message ) );
	} )

	socket.on( 'chat.typing', ( chat_id, text ) => {
		const userIdentity = identityForUser( user )
		debug( 'received operator `typing` event', userIdentity.id, chat_id, text );
		store.dispatch( operatorTyping( chat_id, userIdentity, text ) );
		// events.emit( 'typing', { id: chat_id }, userIdentity, text );
	} )

	socket.on( 'chat.join', ( chat_id ) => {
		debug( 'client requesting to join', chat_id )
		// events.emit( 'chat.join', chat_id, user )
		store.dispatch( operatorChatJoin( chat_id, user ) )
	} )

	socket.on( 'chat.leave', ( chat_id ) => {
		store.dispatch( operatorChatLeave( chat_id, user ) )
		// events.emit( 'chat.leave', chat_id, user )
	} )

	socket.on( 'chat.close', ( chat_id ) => {
		// events.emit( 'chat.close', chat_id, user )
		store.dispatch( operatorChatClose( chat_id, user ) );
	} )

	socket.on( 'chat.transfer', ( chat_id, user_id ) => {
		const toUser = selectIdentity( user_id )
		store.dispatch( operatorChatTransfer( chat_id, user, toUser ) );
		// events.emit( 'chat.transfer', chat_id, user, toUser )
	} )
}

export default ( io, events ) => ( store ) => {
	io.on( 'connection', ( socket ) => {
		debug( 'operator connecting' )
		onConnection( { socket, events } )(
			user => join( { socket, store, user, io } )
		)
	} )

	const identifyClients = ( { clients, timeout, deferred } ) => {
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
				return deferred.reject( error )
			}
			deferred.resolve( results )
		} )
	}

	// TODO - room breaks the abstraction?
	const queryClients = ( { room, deferred } ) => {
		const onClients = ( error, clients ) => {
			if ( error ) {
				return deferred.reject( error )
			}
			deferred.resolve( clients )
		}

		if ( room ) {
			io.in( room ).clients( onClients )
		} else {
			io.clients( onClients )
		}
	}

	const operatorClientQuery = ( { id, deferred } ) => {
		const room = `operators/${ id }`
		io.in( room ).clients( ( error, clients ) => {
			if ( error ) deferred.reject( error )
			deferred.resolve( map( clients, ( socketid ) => io.connected[socketid] ) )
		} )
	}

	const openChatForClients = ( { operator, clients, room, chat, deferred, onDisconnect } ) => {
		const operator_room_name = `operators/${operator.id}`
		parallel( map( clients, ( socket ) => ( complete ) => {
			socket.join( room, ( error ) => {
				// a socket has joined
				debug( 'chat was opened', room )
				events.emit( 'join', chat, operator, socket )
				complete( error )
				socket.on( 'disconnect', onDisconnect )
			} )
		} ), ( e ) => {
			if ( e ) {
				return deferred.reject( e )
			}
			debug( 'Assigning chat: (chat.open)', chat, operator_room_name )
			io.in( operator_room_name ).emit( 'chat.open', chat )
			deferred.resolve( clients )
		} )
	}

	const leaveChat = ( { clients, room, operator_room, chat, deferred } ) => {
		parallel( map( clients, socket => callback => {
			socket.leave( room, error => callback( error, socket ) )
		} ), e => {
			if ( e ) return deferred.reject( e )
			io.in( operator_room ).emit( 'chat.leave', chat )
			deferred.resolve( clients )
		} )
	}

	const queryAvailability = ( { clients, chat, deferred } ) => {
		if ( isEmpty( clients ) ) {
			return deferred.reject( new Error( 'no operators connected' ) )
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
				return deferred.reject( error )
			}
			deferred.resolve( results )
		} )
	}

	const emitOnline = throttle( () => {
		io.emit( 'operators.online', selectIdentities( store.getState() ) );
	}, 100 );

	return ( next ) => ( action ) => {
		// const state = store.getState();
		emitOnline();

		switch ( action.type ) {
			case OPERATOR_MESSAGE:
				events.emit( 'message', { id: action.id }, action.user, action.message );
				break;
			case OPERATOR_TYPING:
				events.emit( 'typing', { id: action.id }, action.userIdentity, action.text );
				break;
			case OPERATOR_CHAT_JOIN:
				events.emit( 'chat.join', action.chat_id, action.user );
				break;
			case OPERATOR_CHAT_LEAVE:
				events.emit( 'chat.leave', action.chat_id, action.user )
				break;
			case OPERATOR_CHAT_CLOSE:
				events.emit( 'chat.close', action.chat_id, action.user )
				break;
			case OPERATOR_CHAT_TRANSFER:
				events.emit( 'chat.transfer', action.chat_id, action.user, action.toUser );
				break;
			case OPERATOR_READY:
				events.emit( 'init', { user: action.user, socket: action.socket, room: action.room } )
			case REMOVE_USER:
				events.emit( 'disconnect', action.user )
				break;
			case OPERATOR_RECEIVE:
				io.in( customerRoom( action.id ) ).emit( 'chat.message', { id: action.id }, action.message )
				break;
			case OPERATOR_RECEIVE_TYPING:
				io.in( customerRoom( action.id ) ).emit( 'chat.typing', action.chat, action.user, action.text )
				break;
			case OPERATOR_CHAT_ONLINE:
				io.in( customerRoom( action.id ) ).emit( 'chat.online', action.id, action.identities )
				break;
			case OPERATOR_IDENTIFY_CLIENT_REQUEST:
				identifyClients( action );
				break;
			case CLIENT_QUERY:
				queryClients( action );
				break;
			case OPERATOR_CLIENT_QUERY:
				operatorClientQuery( action );
				break;
			case OPERATOR_OPEN_CHAT_FOR_CLIENTS:
				openChatForClients( action );
				break;
			case OPERATOR_LEAVE_CHAT:
				leaveChat( action );
				break;
			case OPERATOR_CLOSE_CHAT:
				io.in( action.room ).emit( 'chat.close', action.chat, action.operator )
				break;
			case OPERATOR_QUERY_AVAILABILITY:
				queryAvailability( action );
				break;
		}
		return next( action );
	}
}
