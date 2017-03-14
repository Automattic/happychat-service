import { map, filter, compose, equals, evolve, not, ifElse, lensPath, view } from 'ramda'
import timestamp from '../../timestamp'
import {
	OPERATOR_CHAT_LEAVE,
	OPERATOR_RECEIVE_MESSAGE,
	OPERATOR_RECEIVE_TYPING,
	SEND_OPERATOR_CHAT_LOG,
	REASSIGN_CHATS,
	RECOVER_CHATS,
	SET_CHAT_OPERATOR,
	OPERATOR_CHAT_JOIN,
	CLOSE_CHAT,
	AUTOCLOSE_CHAT
} from '../../action-types'
import {
	operatorInboundMessage,
	closeChat,
	operatorJoinChat,
	setChatsRecovered
} from '../../chatlist/actions'
import {
	getChatMemberIdentities,
	getChat,
	getOpenChatsForOperator,
	getOperatorAbandonedChats
 } from '../../chatlist/selectors'
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

const join = ( { socket, dispatch, user, io }, middlewares ) => {
	const user_room = operatorRoom( user.id )

	const runMiddleware = ( ... args ) => run( middlewares )( ... args )

	socket.on( 'disconnect', () => {
		dispatch( removeUserSocket( socket.id, user ) );
		io.in( user_room ).clients( ( error, clients ) => {
			if ( error ) {
				debug( 'failed to query clients', error.message )
				return;
			}
			if ( clients.length > 0 ) {
				return;
			}
			dispatch( setUserOffline( user ) )
		} )
	} )

	socket.join( user_room, () => {
		dispatch( updateIdentity( socket.id, user ) )
		dispatch( operatorReady( user, socket.id, user_room ) )
		socket.emit( 'init', user )
	} )

	socket.on( 'message', ( chat_id, { id, text } ) => {
		const meta = {}
		const userIdentity = identityForUser( user )
		const message = { id: id, session_id: chat_id, text, timestamp: timestamp(), user: userIdentity, meta }
		// all customer connections for this user receive the message
		dispatch( operatorInboundMessage( chat_id, user, message ) )
	} )

	socket.on( 'chat.typing', ( chat_id, text ) => {
		const identity = identityForUser( user )
		dispatch( operatorTyping( chat_id, identity, text ) );
	} )

	socket.on( 'chat.join', ( chat_id ) => {
		dispatch( operatorChatJoin( chat_id, user ) )
	} )

	socket.on( 'chat.leave', ( chat_id ) => {
		dispatch( operatorChatLeave( chat_id, user ) )
	} )

	socket.on( 'chat.close', ( chat_id ) => {
		dispatch( closeChat( chat_id, user ) );
	} )

	socket.on( 'chat.transfer', ( chat_id, user_id ) => {
		dispatch( operatorChatTransfer( chat_id, user, user_id ) );
	} )

	socket.on( 'chat.transcript', ( chat_id, message_timestamp, callback ) => {
		debug( 'operator is requesting chat backlog', chat_id, 'before', message_timestamp )

		new Promise( ( resolve, reject ) => {
			dispatch(
				operatorChatTranscriptRequest( socket.id, chat_id, message_timestamp )
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
				join( { socket, dispatch: store.dispatch, user, io }, middlewares )
				initializeUserSocket( user, socket )
			},
			e => log( 'operator auth failed', e.message )
		)
	} )

	const emitChatOpenToOperator = ( chat, operator ) => {
		const operator_room_name = operatorRoom( operator.id )
		debug( 'opening chat', chat.id, operator.id )
		store.dispatch( operatorJoinChat( chat, operator ) )
		io.to( operator_room_name ).emit( 'chat.open', chat )
		return Promise.resolve( { chat, operator } )
	}

	const toOperatorsInChat = ( chat_id ) => {
		const members = getChatMemberIdentities( chat_id, store.getState() )
		const rooms = map( member => operatorRoom( member.id ), members )
		for ( const room of rooms ) {
			io.in( room )
		}
		return io
	}

	const handleOperatorReceiveMessage = action => {
		// select all operator indentities and brodcast to their rooms
		toOperatorsInChat( action.id )
			.emit( 'chat.message', { id: action.id }, action.message )
	}

	const handleOperatorReceiveTyping = action => {
		const chat = { id: action.id }
		toOperatorsInChat( chat.id )
			.emit( 'chat.typing', chat, action.user, action.text )
	}

	const handleSendOperatorChatLog = action => {
		io
		.in( operatorRoom( action.operatorId ) )
		.emit( 'log', { id: action.chatId }, action.log )
	}

	const removeOperatorFromChat = ( operator, chat ) => {
		const room = operatorRoom( operator.id )
		io.in( room ).emit( 'chat.leave', chat )
		return Promise.resolve( { chat, operator } )
	}

	const whenChatExists = ( success, failure = () => {} ) => ( chat_id, operator ) => ifElse(
		chat => !! chat,
		chat => success( chat, operator ),
		() => failure( chat_id, operator )
	)( getChat( chat_id, store.getState() ) )

	const handleOperatorChatLeave = action => whenChatExists( ( chat, operator ) => {
		// remove all operator clients from the room
		removeOperatorFromChat( operator, chat )
		.catch( e => debug( 'failed to remove operator from chat', e.message ) )
	}, chat_id => debug( 'chat.leave without existing chat', chat_id ) )( action.chat_id, action.user )

	const handleOperatorChatJoin = action => whenChatExists( ( chat, operator ) => {
		emitChatOpenToOperator( chat, operator )
	}, chat_id => debug( 'chat.join without existing chat', chat_id ) )( action.chat_id, action.user )

	const handleSetChatOperator = ( action ) => {
		let { operator, chat_id } = action
		let chat = getChat( chat_id, store.getState() )
		emitChatOpenToOperator( chat, operator )
	}

	const handleReassignChats = ( action ) => {
		const { operator } = action
		const chats = getOpenChatsForOperator( operator.id, store.getState() )
		Promise.all( map(
			chat => emitChatOpenToOperator( chat, operator ),
			chats
		) )
		.then(
			// NOTE: this may cause existing clients to get notifications of chat.open
			( result ) => debug( 'Reassigned', result.length, 'to operator client', operator.id ),
			e => debug( 'failed to reassign chats to operator', operator.id, e.message )
		)
	}

	const handleRecoverChats = ( action ) => {
		let { operator } = action
		let chats = getOperatorAbandonedChats( operator.id, store.getState() )
		// TODO: should this time out?, not anymore
		debug( 'Recovering chats for operator', chats.length )
		Promise.all( map(
			chat => emitChatOpenToOperator( chat, operator ),
			chats
		) )
		.then(
			result => {
				if ( result.length > 0 ) {
					debug( 'recovered', result.length, 'chats', operator )
					store.dispatch( setChatsRecovered(
						map( view( lensPath( [ 'chat', 'id' ] ) ), result ),
						operator
					) )
				} else {
					debug( 'no chats to recover' )
				}
			},
			e => debug( 'Failed to recover chats for operator', operator.id, e.message )
		)
	}

	const handleAutocloseChat = action => {
		let chat = getChat( action.id, store.getState() )
		if ( !chat ) {
			chat = { id: action.id }
		}
		toOperatorsInChat( chat.id ).emit( 'chat.close', chat, {} )
	}

	const handleCloseChat = ( action ) => {
		const { chat_id, operator } = action
		let chat = getChat( chat_id, store.getState() )
		if ( !chat ) {
			chat = { id: chat_id }
		}
		toOperatorsInChat( chat.id ).emit( 'chat.close', chat, operator )
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
			case OPERATOR_CHAT_LEAVE:
				handleOperatorChatLeave( action )
				return next( action );
			case RECOVER_CHATS:
				handleRecoverChats( action )
				return next( action );
			case REASSIGN_CHATS:
				handleReassignChats( action )
				return next( action );
			case OPERATOR_CHAT_JOIN:
				handleOperatorChatJoin( action )
				return next( action );
			case SET_CHAT_OPERATOR:
				handleSetChatOperator( action )
				return next( action )
			case CLOSE_CHAT:
				handleCloseChat( action )
				break
			case AUTOCLOSE_CHAT:
				handleAutocloseChat( action )
				break
		}
		return onDispatch( next )( action );
	}
}
