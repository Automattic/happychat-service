import { timestamp } from '../../util'
import {
	OPERATOR_RECEIVE_MESSAGE,
	OPERATOR_RECEIVE_TYPING,
} from '../../action-types'
import {
	operatorInboundMessage,
	closeChat
} from '../../chatlist/actions'
import {
	operatorChatLeave,
	updateUserStatus,
	updateCapacity,
	removeUserSocket,
	setUserOffline,
	updateIdentity,
	operatorTyping,
	operatorChatJoin,
	operatorReady,
	operatorChatTransfer,
	operatorChatBacklogRequest
} from '../../operator/actions'

import {
	selectUser,
} from '../../operator/selectors';

const debug = require( 'debug' )( 'happychat:middleware:operators' )

const identityForUser = ( { id, displayName, avatarURL } ) => (
	{ id, displayName, avatarURL }
)

export const customerRoom = id => `customer/${ id }`;
export const operatorRoom = id => `operator/${ id }`;

const join = ( { socket, store, user, io } ) => {
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
				debug( 'failed to query clients', error.message )
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
		store.dispatch( operatorInboundMessage( chat_id, user, message ) )
	} )

	socket.on( 'chat.typing', ( chat_id, text ) => {
		const identity = identityForUser( user )
		store.dispatch( operatorTyping( chat_id, identity, text ) );
	} )

	socket.on( 'chat.join', ( chat_id ) => {
		store.dispatch( operatorChatJoin( chat_id, user ) )
	} )

	socket.on( 'chat.leave', ( chat_id ) => {
		store.dispatch( operatorChatLeave( chat_id, user ) )
	} )

	socket.on( 'chat.close', ( chat_id ) => {
		store.dispatch( closeChat( chat_id, user ) );
	} )

	socket.on( 'chat.transfer', ( chat_id, user_id ) => {
		const toUser = selectIdentity( user_id )
		store.dispatch( operatorChatTransfer( chat_id, user, toUser ) );
	} )

	socket.on( 'chat.backlog', ( chat_id, message_id, message_timestamp ) => {
		debug( 'operator is requesting chat backlog', chat_id, 'before', message_id, message_timestamp )
		store.dispatch( operatorChatBacklogRequest( chat_id, user, message_id, message_timestamp ) )
	} )
}

export default ( io, auth ) => ( store ) => {
	io.on( 'connection', ( socket ) => {
		auth( socket ).then(
			user => join( { socket, store, user, io } ),
			e => debug( 'operator auth failed', e.message )
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
