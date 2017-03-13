import {
	map,
	ifElse,
	isEmpty,
	view,
	lensPath,
	compose,
	tap,
} from 'ramda'
import { throttle } from 'lodash'
import {
	AUTOCLOSE_CHAT,
	CLOSE_CHAT,
	CUSTOMER_RECEIVE_TYPING,
	CUSTOMER_RECEIVE_MESSAGE,
	CUSTOMER_JOIN,
	INSERT_PENDING_CHAT,
	REASSIGN_CHATS,
	RECOVER_CHATS,
	SET_CHAT_OPERATOR,
	SET_CHAT_MISSED,
	NOTIFY_SYSTEM_STATUS_CHANGE,
	NOTIFY_CHAT_STATUS_CHANGED,
	REMOVE_USER,
	SET_USER_OFFLINE,
	OPERATOR_CHAT_LEAVE,
	OPERATOR_READY,
	OPERATOR_CHAT_JOIN,
	OPERATOR_CHAT_TRANSFER,
	SEND_CUSTOMER_CHAT_LOG
} from '../../action-types'
import {
	assignNextChat,
	reassignChats,
	recoverChats,
	setChatsRecovered,
	setOperatorChatsAbandoned,
	customerInboundMessage,
	customerTyping,
	customerJoin,
	operatorJoinChat,
	customerSocketDisconnect,
	customerDisconnect,
	customerChatTranscriptRequest,
} from '../../chatlist/actions'
import {
	getChat,
	getOpenChatsForOperator,
	getChatStatus,
	getOperatorAbandonedChats,
	getAllNewChats,
} from '../../chatlist/selectors'
import {
	canAcceptChat
} from '../../operator/selectors'
import { run } from '../../../middleware-interface'
import timestamp from '../../timestamp'
import { operatorRoom } from './operator'

export const customerRoom = id => `customer/${ id }`;

const debug = require( 'debug' )( 'happychat-debug:middleware:chatlist' )
const log = require( 'debug' )( 'happychat:middleware:chatlist' )

// limit the information for the user
const identityForUser = ( { id, name, username, picture } ) => ( { id, name, username, picture } )

const whenNoClients = ( io, room ) => new Promise( ( resolve, reject ) => {
	io.in( room ).clients( ( error, clients ) => {
		if ( error ) {
			return reject( error )
		}

		if ( clients.length > 0 ) {
			return reject( new Error( 'Have other connected clients' ) )
		}

		resolve()
	} )
} )

const init = ( { user, socket, io, dispatch, chat }, middlewares ) => () => {
	const runMiddleware = ( ... args ) => run( middlewares )( ... args )

	socket.on( 'message', ( { text, id, meta } ) => {
		const message = { session_id: chat.id, id: id, text, timestamp: timestamp(), user: identityForUser( user ), meta }
		// all customer connections for this user receive the message
		dispatch( customerInboundMessage( chat, message, user ) )
	} )

	socket.on( 'typing', throttle( ( text ) => {
		dispatch( customerTyping( chat.id, user, text ) )
	}, 100, { leading: true } ) )

	socket.on( 'disconnect', () => {
		dispatch( customerSocketDisconnect( socket.id, chat, user ) )

		whenNoClients( io, customerRoom( chat.id ) )
			.then( () => dispatch( customerDisconnect( chat, user ) ) )
	} )

	socket.on( 'transcript', ( transcript_timestamp, callback ) => {
		new Promise( ( resolve, reject ) => {
			dispatch(
				customerChatTranscriptRequest( chat, transcript_timestamp )
			).then( resolve, reject )
		} )
		.then( result => new Promise( ( resolve, reject ) => {
			Promise.all( map( message => runMiddleware( {
				origin: message.source,
				destination: 'customer',
				user: message.user,
				message,
				chat
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

	socket.emit( 'init', user )
	dispatch( customerJoin( chat, user ) )
}

const join = ( { io, user, socket, dispatch }, middlewares ) => {
	const chat = {
		user_id: user.id,
		id: user.session_id,
		username: user.username,
		name: user.displayName,
		picture: user.picture,
		locale: user.locale,
		groups: user.groups
	}
	socket.join( customerRoom( chat.id ), init( { user, socket, io, dispatch, chat }, middlewares ) )
}

export default ( { io, timeout = 1000 }, customerAuth, middlewares = [] ) => store => {
	const operator_io = io.of( '/operator' )
	const customer_io = io.of( '/customer' )
	.on( 'connection', socket => {
		customerAuth( socket )
		.then(
			user => join( { socket, user, io: customer_io, dispatch: store.dispatch }, middlewares ),
			e => log( 'customer auth failed', e.message )
		)
	} )

	const removeOperatorFromChat = ( operator, chat ) => {
		const room = operatorRoom( operator.id )
		operator_io.in( room ).emit( 'chat.leave', chat )
		return Promise.resolve( { chat, operator } )
	}

	const emitChatOpenToOperator = ( chat, operator ) => {
		const operator_room_name = operatorRoom( operator.id )
		debug( 'opening chat', chat.id, operator.id )
		store.dispatch( operatorJoinChat( chat, operator ) )
		operator_io.to( operator_room_name ).emit( 'chat.open', chat )
		return Promise.resolve( { chat, operator } )
	}

	const handleCustomerReceiveMessage = action => {
		const { id, message } = action
		customer_io.to( customerRoom( id ) ).emit( 'message', message )
	}

	const handleCustomerReceiveTyping = action => {
		const { id, text } = action
		customer_io.to( customerRoom( id ) ).emit( 'typing', text && !isEmpty( text ) )
	}

	const handleCustomerJoin = action => {
		const { chat } = action
		const accept = canAcceptChat( chat.id, store.getState() )
		customer_io.to( customerRoom( chat.id ) ).emit( 'accept', accept )
	}

	const whenChatExists = ( success, failure = () => {} ) => ( chat_id, operator ) => ifElse(
		chat => !! chat,
		chat => success( chat, operator ),
		() => failure( chat_id, operator )
	)( getChat( chat_id, store.getState() ) )

	const handleOperatorReady = ( { user, socket_id } ) => {
		store.dispatch( recoverChats( user, socket_id ) )
		store.dispatch( reassignChats( user, socket_id ) )
	}

	const handleOperatorDisconnect = action => {
		store.dispatch( setOperatorChatsAbandoned( action.user.id ) )
	}

	const handleOperatorChatJoin = action => whenChatExists( ( chat, operator ) => {
		emitChatOpenToOperator( chat, operator )
	}, chat_id => debug( 'chat.join without existing chat', chat_id ) )( action.chat_id, action.user )

	const handleOperatorChatLeave = action => whenChatExists( ( chat, operator ) => {
		// remove all operator clients from the room
		removeOperatorFromChat( operator, chat )
		.catch( e => debug( 'failed to remove operator from chat', e.message ) )
	}, chat_id => debug( 'chat.leave without existing chat', chat_id ) )( action.chat_id, action.user )

	const handleAutocloseChat = action => {
		let chat = getChat( action.id, store.getState() )
		if ( !chat ) {
			chat = { id: action.id }
		}
		operator_io.to( customerRoom( chat.id ) ).emit( 'chat.close', chat, {} )
	}

	const handleCloseChat = ( action ) => {
		const { chat_id, operator } = action
		let chat = getChat( chat_id, store.getState() )
		if ( !chat ) {
			chat = { id: chat_id }
		}
		operator_io.to( customerRoom( chat_id ) ).emit( 'chat.close', chat, operator )
	}

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

	const handleNotifiSystemStatusChange = () => {
		// get all new chats and notify their status
		compose(
			map( tap( chat => {
				customer_io
					.to( customerRoom( chat.id ) )
					.emit( 'accept', canAcceptChat( chat.id, store.getState() ) )
			} ) ),
			getAllNewChats
		)( store.getState() )
	}

	const handleSendCustomerChatLog = action => {
		customer_io.to( customerRoom( action.id ) ).emit( 'log', action.log )
	}

	return next => action => {
		switch ( action.type ) {
			case NOTIFY_SYSTEM_STATUS_CHANGE:
				handleNotifiSystemStatusChange( action )
				break;
			case NOTIFY_CHAT_STATUS_CHANGED:
				const status = getChatStatus( action.chat_id, store.getState() );
				customer_io.to( customerRoom( action.chat_id ) ).emit( 'status', status )
				break;
			case RECOVER_CHATS:
				handleRecoverChats( action )
				return next( action );
			case REASSIGN_CHATS:
				handleReassignChats( action )
				return next( action );
			case OPERATOR_CHAT_JOIN:
				handleOperatorChatJoin( action )
				return next( action );
			case OPERATOR_CHAT_LEAVE:
				handleOperatorChatLeave( action )
				return next( action );
			case OPERATOR_CHAT_TRANSFER:
				// handleTransferChat( action )
				return next( action )
			case OPERATOR_READY:
				handleOperatorReady( action )
				return next( action )
			case REMOVE_USER:
			case SET_USER_OFFLINE:
				handleOperatorDisconnect( action )
				return next( action )
			case SET_CHAT_OPERATOR:
				handleSetChatOperator( action )
				return next( action )
			case CUSTOMER_RECEIVE_TYPING:
				handleCustomerReceiveTyping( action )
				return next( action )
			case CUSTOMER_RECEIVE_MESSAGE:
				handleCustomerReceiveMessage( action )
				return next( action )
			case CUSTOMER_JOIN:
				handleCustomerJoin( action )
				return next( action )
			case CLOSE_CHAT:
				handleCloseChat( action )
				break
			case AUTOCLOSE_CHAT:
				handleAutocloseChat( action )
				break
			case SEND_CUSTOMER_CHAT_LOG:
				handleSendCustomerChatLog( action )
				break;
		}
		const result = next( action )
		switch ( action.type ) {
			case SET_CHAT_MISSED:
			case INSERT_PENDING_CHAT:
				store.dispatch( assignNextChat() )
				break;
		}
		return result
	}
}
