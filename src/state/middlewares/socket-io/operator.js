import { map, filter, compose, equals, evolve, not } from 'ramda'
import timestamp from '../../timestamp'
import {
	OPERATOR_RECEIVE_MESSAGE,
	OPERATOR_RECEIVE_TYPING,
	SEND_OPERATOR_CHAT_LOG
} from '../../action-types'
import { operatorInboundMessage, closeChat } from '../../chatlist/actions'
import { getChat, getChatMemberIdentities } from '../../chatlist/selectors'
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
import canRemoteDispatch from '../../operator/can-remote-dispatch'
import shouldBroadcastStateChange from '../../should-broadcast'
import broadcastMiddleware from './broadcast'
import { STATUS_CLOSED, statusView } from '../../chatlist/reducer'

const log = require( 'debug' )( 'happychat:middleware:operators' )
const debug = require( 'debug' )( 'happychat-debug:middleware:operators' )

const identityForUser = ( { id, displayName, avatarURL } ) => (
	{ id, displayName, avatarURL }
)

const filterClosed = filter( compose(
	not,
	equals( STATUS_CLOSED ),
	statusView,
) )

export const operatorRoom = id => `operator/${ id }`;

const join = ( { socket, store, user, io }, middlewares ) => {
	const user_room = operatorRoom( user.id )

	const runMiddleware = ( ... args ) => run( middlewares )( ... args )

	const selectIdentity = userId => selectUser( store.getState(), userId );

	socket.on( 'disconnect', () => {
		store.dispatch( removeUserSocket( socket.id, user ) );
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
		store.dispatch( updateIdentity( socket.id, user ) )
		// If the operator is not a member of any groups they should be
		// assigned to the default group
		if ( ! isOperatorMemberOfAnyGroup( user.id, store.getState() ) ) {
			store.dispatch( addGroupMember( DEFAULT_GROUP_ID, user.id ) )
		}
		store.dispatch( operatorReady( user, socket.id, user_room ) )
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
	const { onDispatch, initializeUserSocket } = broadcastMiddleware( io, {
		canRemoteDispatch,
		shouldBroadcastStateChange,
		selector: evolve( { chatlist: filterClosed } )
	} )( store )

	io.on( 'connection', ( socket ) => {
		auth( socket ).then(
			user => {
				join( { socket, store, user, io }, middlewares )
				initializeUserSocket( user, socket )
			},
			e => log( 'operator auth failed', e.message )
		)
	} )

	const handleOperatorReceiveMessage = action => {
		// select all operator indentities and brodcast to their rooms
		const members = getChatMemberIdentities( action.id, store.getState() )
		const rooms = map( member => operatorRoom( member.id ), members )
		debug( 'members', rooms )
		for ( const room of rooms ) {
			io.in( room )
		}
		io.emit( 'chat.message', { id: action.id }, action.message )
	}

	const handleOperatorReceiveTyping = action => {
		const chat = { id: action.id }
		const members = getChatMemberIdentities( action.id, store.getState() )
		const rooms = map( member => operatorRoom( member.id ), members )
		for ( const room of rooms ) {
			io.in( room )
		}
		io.emit( 'chat.typing', chat, action.user, action.text )
	}

	const handleSendOperatorChatLog = action => {
		io
		.in( operatorRoom( action.operatorId ) )
		.emit( 'log', { id: action.chatId }, action.log )
	}

	return ( next ) => ( action ) => {
		switch ( action.type ) {
			case OPERATOR_RECEIVE_MESSAGE:
				handleOperatorReceiveMessage( action )
				break;
			case OPERATOR_RECEIVE_TYPING:
				handleOperatorReceiveTyping( action )
				break;
			case SEND_OPERATOR_CHAT_LOG:
				handleSendOperatorChatLog( action )
				break;
		}
		return onDispatch( next )( action );
	}
}
