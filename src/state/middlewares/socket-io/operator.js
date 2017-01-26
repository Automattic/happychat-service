import { map } from 'ramda'
import timestamp from '../../timestamp'
import {
	OPERATOR_RECEIVE_MESSAGE,
	OPERATOR_RECEIVE_TYPING,
} from '../../action-types'
import { operatorInboundMessage, closeChat } from '../../chatlist/actions'
import { getChat } from '../../chatlist/selectors'
import { DEFAULT_GROUP_ID, isOperatorMemberOfAnyGroup } from '../../groups/selectors'
import { addGroupMember } from '../../groups/actions'
import {
	operatorChatLeave,
	removeUserSocket,
	setUserOffline,
	updateIdentity,
	operatorTyping,
	operatorChatJoin,
	operatorReady,
	operatorChatTransfer,
	operatorChatTranscriptRequest
} from '../../operator/actions'
import {
	selectUser,
} from '../../operator/selectors';
import { run } from '../../../middleware-interface'

const debug = require( 'debug' )( 'happychat:middleware:operators' )

const identityForUser = ( { id, displayName, avatarURL } ) => (
	{ id, displayName, avatarURL }
)

export const customerRoom = id => `customer/${ id }`;
export const operatorRoom = id => `operator/${ id }`;

const join = ( { socket, store, user, io }, middlewares ) => {
	const user_room = operatorRoom( user.id )

	const runMiddleware = ( ... args ) => run( middlewares )( ... args )

	const selectIdentity = userId => selectUser( store.getState(), userId );

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
		// If the operator is not a member of any groups they should be
		// assigned to the default group
		if ( ! isOperatorMemberOfAnyGroup( user ) ) {
			store.dispatch( addGroupMember( DEFAULT_GROUP_ID, user.id ) )
		}
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

	socket.on( 'chat.transcript', ( chat_id, message_timestamp, callback ) => {
		debug( 'operator is requesting chat backlog', chat_id, 'before', message_timestamp )
		const chat = getChat( chat_id, store.getState() )

		new Promise( ( resolve, reject ) => {
			store.dispatch(
				operatorChatTranscriptRequest( user, chat, message_timestamp )
			).then( resolve, reject )
		} )
		.then( result => new Promise( ( resolve, reject ) => {
			debug( 'chat.transcript', chat_id, result.timestamp, result.messages.length )
			// debug time to run each message through middleware
			Promise.all( map( message => runMiddleware( {
				origin: message.source,
				destination: 'operator',
				user: message.user,
				message,
				chat: { id: chat_id }
			} ), result.messages ) )
			.then(
				messages => resolve( { timestamp: result.timestamp, messages } ),
				reject
			)
		} ) )
		.then(
			result => callback( null, result ),
			e => callback( e.message, null )
		)
	} )
}

export default ( io, auth, middlewares ) => ( store ) => {
	io.on( 'connection', ( socket ) => {
		auth( socket ).then(
			user => join( { socket, store, user, io }, middlewares ),
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
