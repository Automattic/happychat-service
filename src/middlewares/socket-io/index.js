import { timestamp } from '../../util'
import {
	OPERATOR_RECEIVE_MESSAGE,
	operatorInboundMessage,
	closeChat
} from '../../chat-list/actions'
import {
	OPERATOR_RECEIVE_TYPING,
	operatorChatLeave,
	updateUserStatus,
	updateCapacity,
	removeUserSocket,
	setUserOffline,
	updateIdentity,
	operatorTyping,
	operatorChatJoin,
	operatorReady,
	operatorChatTransfer
} from '../../operator/actions'

import {
	selectUser,
} from '../../operator/selectors';

const debug = require( 'debug' )( 'happychat:middleware:operators' )

export const STATUS_AVAILABLE = 'available';

const identityForUser = ( { id, displayName, avatarURL } ) => (
	{ id, displayName, avatarURL }
)

export const customerRoom = id => `customer/${ id }`;
export const operatorRoom = id => `operator/${ id }`;

const join = ( { socket, store, user, io } ) => {
	debug( 'initialize the operator', user )

	const user_room = operatorRoom( user.id )

	const selectIdentity = userId => selectUser( store.getState(), userId );

	socket.on( 'status', ( status, done ) => {
		store.dispatch( updateUserStatus( user, status ) );
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
			store.dispatch( setUserOffline( user ) )
		} )
	} )

	socket.join( user_room, () => {
		store.dispatch( updateIdentity( socket, user ) )
		store.dispatch( operatorReady( user, socket, user_room ) )
		socket.emit( 'init', user )
	} )

	socket.on( 'message', ( chat_id, { id, text } ) => {
		const meta = {}
		const userIdentity = identityForUser( user )
		const message = { id: id, session_id: chat_id, text, timestamp: timestamp(), user: userIdentity, meta }
		// all customer connections for this user receive the message
		debug( 'broadcasting message', user.id, id, message )
		// store.dispatch( operatorMessage( chat_id, user, message ) );
		store.dispatch( operatorInboundMessage( chat_id, user, message ) )
	} )

	socket.on( 'chat.typing', ( chat_id, text ) => {
		const identity = identityForUser( user )
		debug( 'received operator `typing` event', identity.id, chat_id, text );
		store.dispatch( operatorTyping( chat_id, identity, text ) );
	} )

	socket.on( 'chat.join', ( chat_id ) => {
		debug( 'client requesting to join', chat_id )
		store.dispatch( operatorChatJoin( chat_id, user ) )
	} )

	socket.on( 'chat.leave', ( chat_id ) => {
		store.dispatch( operatorChatLeave( chat_id, user ) )
	} )

	socket.on( 'chat.close', ( chat_id ) => {
		store.dispatch( closeChat( chat_id, user ) );
	} )

	socket.on( 'chat.transfer', ( chat_id, user_id ) => {
		debug( 'transfer', chat_id, 'to', user_id )
		const toUser = selectIdentity( user_id )
		store.dispatch( operatorChatTransfer( chat_id, user, toUser ) );
	} )
}

export default ( io, auth ) => ( store ) => {
	io.on( 'connection', ( socket ) => {
		debug( 'operator connecting' )
		auth( socket ).then(
			user => join( { socket, store, user, io } ),
			e => debug( 'operator auth failed', e )
		)
	} )

	return ( next ) => ( action ) => {
		switch ( action.type ) {
			case OPERATOR_RECEIVE_MESSAGE:
				io.in( customerRoom( action.id ) ).emit( 'chat.message', { id: action.id }, action.message )
				break;
			case OPERATOR_RECEIVE_TYPING:
				const chat = { id: action.id }
				io.in( customerRoom( action.id ) ).emit( 'chat.typing', chat, action.user, action.text )
				break;
		}
		return next( action );
	}
}
