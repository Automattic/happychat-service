import { onConnection, timestamp } from '../../util'
import {
	OPERATOR_RECEIVE,
	OPERATOR_RECEIVE_TYPING,
	OPERATOR_CLOSE_CHAT,
	updateUserStatus,
	updateCapacity,
	removeUserSocket,
	removeUser,
	updateIdentity,
} from '../../operator/actions';

import {
	selectUser,
} from '../../operator/selectors';

const debug = require( 'debug' )( 'happychat:middleware:operators' )

export const STATUS_AVAILABLE = 'available';

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

export const OPERATOR_CHAT_JOIN = 'OPERATOR_CHAT_JOIN';
export const operatorChatJoin = ( chat_id, user ) => (
	{ type: OPERATOR_CHAT_JOIN, chat_id, user }
)

export const OPERATOR_CHAT_LEAVE = 'OPERATOR_CHAT_LEAVE';
export const operatorChatLeave = ( chat_id, user ) => (
	{ type: OPERATOR_CHAT_LEAVE, chat_id, user }
)

export const OPERATOR_CHAT_CLOSE = 'OPERATOR_CHAT_CLOSE';
const operatorChatClose = ( chat_id, user ) => (
	{ type: OPERATOR_CHAT_CLOSE, chat_id, user }
)

export const OPERATOR_CHAT_TRANSFER = 'OPERATOR_CHAT_TRANSFER';
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
		store.dispatch( removeUserSocket( socket, user ) );
		io.in( user_room ).clients( ( error, clients ) => {
			if ( error ) {
				debug( 'failed to query clients', error )
				return;
			}
			if ( clients.length > 0 ) {
				return;
			}
			store.dispatch( removeUser( user ) )
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
		store.dispatch( operatorChatJoin( chat_id, user ) )
	} )

	socket.on( 'chat.leave', ( chat_id ) => {
		store.dispatch( operatorChatLeave( chat_id, user ) )
	} )

	socket.on( 'chat.close', ( chat_id ) => {
		store.dispatch( operatorChatClose( chat_id, user ) );
	} )

	socket.on( 'chat.transfer', ( chat_id, user_id ) => {
		debug( 'transfer', chat_id, 'to', user_id )
		const toUser = selectIdentity( user_id )
		store.dispatch( operatorChatTransfer( chat_id, user, toUser ) );
		// events.emit( 'chat.transfer', chat_id, user, toUser )
	} )
}

export default ( io, events ) => ( store ) => {
	io.on( 'connection', ( socket ) => {
		debug( 'operator connecting' )
		onConnection(
			{ socket, events },
			user => join( { socket, store, user, io } )
		)
	} )

	return ( next ) => ( action ) => {
		switch ( action.type ) {
			case OPERATOR_MESSAGE:
				events.emit( 'message', { id: action.id }, action.user, action.message );
				break;
			case OPERATOR_TYPING:
				events.emit( 'typing', { id: action.id }, action.userIdentity, action.text );
				break;
			case OPERATOR_RECEIVE:
				io.in( customerRoom( action.id ) ).emit( 'chat.message', { id: action.id }, action.message )
				break;
			case OPERATOR_RECEIVE_TYPING:
				io.in( customerRoom( action.id ) ).emit( 'chat.typing', action.chat, action.user, action.text )
				break;
			case OPERATOR_CLOSE_CHAT:
				io.in( action.room ).emit( 'chat.close', action.chat, action.operator )
				break;

		}
		return next( action );
	}
}
