import { onConnection, timestamp } from '../../util'
import {
	REMOVE_USER,
	updateUserStatus,
	updateCapacity,
	removeUserSocket,
	removeUser,
	updateIdentity,
	selectUser,
} from '../../operator/store';

const debug = require( 'debug' )( 'happychat:middleware:operators' )

const identityForUser = ( { id, displayName, avatarURL } ) => (
	{ id, displayName, avatarURL }
)

// Actions
const OPERATOR_MESSAGE = 'OPERATOR_MESSAGE';
const operatorMessage = ( id, user, message ) => {
	return {
		type: OPERATOR_MESSAGE,
		id,
		user,
		message
	}
}

const OPERATOR_TYPING = 'OPERATOR_TYPING';
const operatorTyping = ( id, userIdentity, text ) => {
	return {
		type: OPERATOR_TYPING,
		id,
		userIdentity,
		text
	}
}

const OPERATOR_CHAT_JOIN = 'OPERATOR_CHAT_JOIN';
const operatorChatJoin = ( chat_id, user ) => {
	return {
		type: OPERATOR_CHAT_JOIN,
		chat_id,
		user
	}
}

const OPERATOR_CHAT_LEAVE = 'OPERATOR_CHAT_LEAVE';
const operatorChatLeave = ( chat_id, user ) => {
	return {
		type: OPERATOR_CHAT_LEAVE,
		chat_id,
		user
	}
}

const OPERATOR_CHAT_CLOSE = 'OPERATOR_CHAT_CLOSE';
const operatorChatClose = ( chat_id, user ) => {
	return {
		type: OPERATOR_CHAT_CLOSE,
		chat_id,
		user
	}
}

const OPERATOR_CHAT_TRANSFER = 'OPERATOR_CHAT_TRANSFER';
const operatorChatTransfer = ( chat_id, user, toUser ) => {
	return {
		type: OPERATOR_CHAT_TRANSFER,
		chat_id,
		user,
		toUser
	}
}

const OPERATOR_READY = 'OPERATOR_READY'
const operatorReady = ( user, socket, room ) => ( {
	type: OPERATOR_READY, user, socket, room
} )

const join = ( { socket, store, user, io } ) => {
	debug( 'initialize the operator', user )

	const user_room = `operators/${user.id}`

	const selectIdentity = userId => selectUser( store.getState(), userId );

	socket.on( 'status', ( status, done ) => {
		// TODO: if operator has multiple clients, move all of them?
		const updateStatus = ( e ) => {
			store.dispatch( updateUserStatus( user, status ) );
			// events.emit( 'status', user, status )
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

	return ( next ) => ( action ) => {
		// const state = store.getState();

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
		}
		return next( action );
	}
}
