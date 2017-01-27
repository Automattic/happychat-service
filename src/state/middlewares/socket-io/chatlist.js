import {
	merge,
	map,
	ifElse,
	isEmpty,
	view,
	lensPath,
	compose,
	tap
} from 'ramda'
import { delayAction, cancelAction } from 'redux-delayed-dispatch'
import { v4 as uuid } from 'uuid'

import {
	ASSIGN_CHAT,
	ASSIGN_NEXT_CHAT,
	AUTOCLOSE_CHAT,
	CLOSE_CHAT,
	CUSTOMER_RECEIVE_TYPING,
	CUSTOMER_INBOUND_MESSAGE,
	CUSTOMER_RECEIVE_MESSAGE,
	CUSTOMER_DISCONNECT,
	CUSTOMER_LEFT,
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
	OPERATOR_CHAT_TRANSFER
} from '../../action-types'
import {
	assignChat,
	assignNextChat,
	insertPendingChat,
	insertNewChat,
	reassignChats,
	recoverChats,
	setChatMissed,
	setChatOperator,
	setChatsRecovered,
	setOperatorChatsAbandoned,
	setChatCustomerDisconnect,
	operatorInboundMessage,
	customerInboundMessage,
	customerTyping,
	customerJoin,
	operatorJoinChat,
	customerSocketDisconnect,
	customerDisconnect,
	customerChatTranscriptRequest,
	customerLeft,
	autocloseChat,
	updateChat
} from '../../chatlist/actions'
import {
	getChat,
	getChatOperator,
	getOpenChatsForOperator,
	getChatStatus,
	getChatLocale,
	getNextAssignableChat,
	getOperatorAbandonedChats,
	haveAssignableChat,
	isChatStatusNew,
	isChatStatusClosed,
	isAssigningChat,
	getChatGroups,
	getAllNewChats
} from '../../chatlist/selectors'
import {
	STATUS_CUSTOMER_DISCONNECT,
} from '../../chatlist/reducer'
import {
	getAvailableOperators,
	isOperatorAcceptingChats,
	haveAvailableCapacity,
	canAcceptChat
} from '../../operator/selectors'
import { run } from '../../../middleware-interface'
import timestamp from '../../timestamp'
import { customerRoom, operatorRoom } from './operator'

const debug = require( 'debug' )( 'happychat:middleware:chatlist' )

export const makeEventMessage = ( text, session_id ) => ( {
	type: 'event',
	id: uuid(),
	timestamp: timestamp(),
	session_id: session_id,
	text
} )

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

const withTimeout = ( promise, ms = 1000 ) => Promise.race( [
	promise,
	new Promise( ( resolve, reject ) => {
		setTimeout( () => reject( new Error( 'timeout' ) ), ms )
	} )
] )

const init = ( { user, socket, io, store, chat }, middlewares ) => () => {
	const runMiddleware = ( ... args ) => run( middlewares )( ... args )

	socket.on( 'message', ( { text, id, meta } ) => {
		const message = { session_id: chat.id, id: id, text, timestamp: timestamp(), user: identityForUser( user ), meta }
		// all customer connections for this user receive the message
		store.dispatch( customerInboundMessage( chat, message, user ) )
	} )

	socket.on( 'typing', ( text ) => {
		store.dispatch( customerTyping( chat.id, user, text ) )
	} )

	socket.on( 'disconnect', () => {
		store.dispatch( customerSocketDisconnect( socket, chat, user ) )

		whenNoClients( io, customerRoom( chat.id ) )
			.then( () => store.dispatch( customerDisconnect( chat, user ) ) )
	} )

	socket.on( 'transcript', ( transcript_timestamp, callback ) => {
		new Promise( ( resolve, reject ) => {
			store.dispatch(
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
	store.dispatch( customerJoin( socket, chat, user ) )
}

const join = ( { io, user, socket, store }, middlewares ) => {
	const chat = {
		user_id: user.id,
		id: user.session_id,
		username: user.username,
		name: user.displayName,
		picture: user.picture,
		locale: user.locale,
		groups: user.groups
	}
	socket.join( customerRoom( chat.id ), init( { user, socket, io, store, chat }, middlewares ) )
}

const getClients = ( server, room ) => new Promise( ( resolve, reject ) => {
	server.in( room ).clients( ( e, ids ) => {
		if ( e ) {
			return reject( e )
		}
		resolve( map( id => server.connected[id], ids ) )
	} )
} )

export default ( { io, timeout = 1000, customerDisconnectTimeout = 90000, customerDisconnectMessageTimeout = 10000 }, customerAuth, middlewares = [] ) => store => {
	const operator_io = io.of( '/operator' )
	const customer_io = io.of( '/customer' )
	.on( 'connection', socket => {
		customerAuth( socket )
		.then(
			user => join( { socket, user, io: customer_io, store }, middlewares ),
			e => debug( 'customer auth failed', e.message )
		)
	} )

	const removeOperatorsFromChat = ( chat ) => {
		const room = customerRoom( chat.id )
		return getClients( operator_io, room )
		.then( clients => Promise.all(
			map( socket => new Promise( ( resolve, reject ) => {
				socket.leave( room, e => {
					if ( e ) return reject( e )
					resolve( socket )
				} )
			} ), clients )
		) )
	}

	const removeOperatorFromChat = ( operator, chat ) => {
		const customer_room_name = customerRoom( chat.id )
		const room = operatorRoom( operator.id )
		return getClients( operator_io, room )
		.then( clients => Promise.all(
			map( socket => new Promise( ( resolve, reject ) => {
				socket.leave( customer_room_name, e => {
					if ( e ) return reject( e )
					resolve( socket )
				} )
			} ), clients )
		) )
		.then( () => new Promise( resolve => {
			operator_io.in( room ).emit( 'chat.leave', chat )
			resolve( { chat, operator } )
		} ) )
	}

	const emitChatOpenToOperator = ( chat, operator ) => {
		const customer_room_name = customerRoom( chat.id )
		const operator_room_name = operatorRoom( operator.id )
		debug( 'opening chat with timeout', chat.id, operator.id, timeout )
		return getClients( operator_io, operator_room_name )
		.then( clients => Promise.race( [
			Promise.all( map( socket => new Promise( ( resolve, reject ) => {
				socket.join( customer_room_name, ( error ) => {
					if ( error ) return reject( error )
					resolve( socket )
					store.dispatch( operatorJoinChat( socket, chat, operator ) )
				} )
			} ), clients ) ),
			new Promise( ( resolve, reject ) => setTimeout( () => {
				reject( new Error( 'timeout' ) )
			}, timeout ) )
		] ) )
		.then( () => new Promise( resolve => {
			operator_io.to( operator_room_name ).emit( 'chat.open', chat )
			resolve( { chat, operator } )
		} ) )
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
		const state = store.getState()

		const accept = canAcceptChat( chat.id, state )
		customer_io.to( customerRoom( chat.id ) ).emit( 'accept', accept )
		const status = getChatStatus( chat.id, state )
		const operator = getChatOperator( chat.id, state )
		if ( ! isChatStatusNew( chat.id, state ) ) {
			store.dispatch( updateChat( chat ) )
		} else {
			store.dispatch( insertNewChat( chat ) )
		}
		store.dispatch( cancelAction( customerLeft( chat.id ) ) )
		store.dispatch( cancelAction( autocloseChat( chat.id ) ) )
		if ( operator && !isEmpty( operator ) && status === STATUS_CUSTOMER_DISCONNECT ) {
			store.dispatch( setChatOperator( chat.id, operator ) )
			return
		}
	}

	const whenChatExists = ( success, failure = () => {} ) => ( chat_id, operator ) => ifElse(
		chat => !! chat,
		chat => success( chat, operator ),
		() => failure( chat_id, operator )
	)( getChat( chat_id, store.getState() ) )

	const handleCustomerDisconnect = action => {
		const { chat } = action
		if ( isChatStatusNew( chat.id, store.getState() ) ) {
			debug( 'Customer disconnected without starting chat', chat.id )
			return;
		}

		if ( isChatStatusClosed( chat.id, store.getState() ) ) {
			debug( 'Customer disconnected after chat closed' )
			return
		}
		store.dispatch( setChatCustomerDisconnect( chat.id ) )
		store.dispatch( delayAction( customerLeft( chat.id ), customerDisconnectMessageTimeout ) )
		store.dispatch( delayAction( autocloseChat( chat.id ), customerDisconnectTimeout ) )
	}

	const handleCustomerLeft = action => {
		const operator = getChatOperator( action.id, store.getState() )
		store.dispatch( operatorInboundMessage( action.id, operator, merge(
			makeEventMessage( 'customer left', action.id ),
			{ meta: { event_type: 'customer-leave' } }
		) ) )
	}

	const handleOperatorReady = ( { user, socket } ) => {
		store.dispatch( recoverChats( user, socket ) )
		store.dispatch( reassignChats( user, socket ) )
	}

	const handleOperatorDisconnect = action => {
		store.dispatch( setOperatorChatsAbandoned( action.user.id ) )
	}

	const handleOperatorChatJoin = action => whenChatExists( ( chat, operator ) => {
		emitChatOpenToOperator( chat, operator ).then( () => {
			store.dispatch( operatorInboundMessage( chat.id, operator, merge(
				makeEventMessage( 'operator joined', chat.id ),
				{	meta: { operator, event_type: 'join' } }
			) ) )
		} )
	}, chat_id => debug( 'chat.join without existing chat', chat_id ) )( action.chat_id, action.user )

	const handleOperatorChatLeave = action => whenChatExists( ( chat, operator ) => {
		// remove all operator clients from the room
		store.dispatch( operatorInboundMessage( chat.id, operator, merge(
			makeEventMessage( 'operator left', chat.id ),
			{ meta: { operator, event_type: 'leave' } }
		) ) )
		removeOperatorFromChat( operator, chat )
		.catch( e => debug( 'failed to remove operator from chat', e.message ) )
	}, chat_id => debug( 'chat.leave without existing chat', chat_id ) )( action.chat_id, action.user )

	const handleCustomerInboundMessage = ( { chat } ) => {
		const state = store.getState()
		const operator = getChatOperator( chat.id, state )
		const isNew = isChatStatusNew( chat.id, state )
		const isClosed = isChatStatusClosed( chat.id, state )

		if ( operator && isOperatorAcceptingChats( operator.id, state ) && isClosed ) {
			emitChatOpenToOperator( chat, operator )
			.then(
				() => store.dispatch( setChatOperator( chat.id, operator ) ),
				e => store.dispatch( setChatMissed( chat.id, e ) )
			)

			return
		}

		if ( !operator || isNew || isClosed ) {
			store.dispatch( insertPendingChat( chat ) )
			return
		}

		// TODO: check if there is an operator in the room
		debug( 'chat exists time to make sure someone is home' )
	}

	const handleAutocloseChat = action => {
		let chat = getChat( action.id, store.getState() )
		if ( !chat ) {
			chat = { id: action.id }
		}
		operator_io.to( customerRoom( chat.id ) ).emit( 'chat.close', chat, {} )
		store.dispatch( operatorInboundMessage( chat.id, {}, merge(
			makeEventMessage( 'chat closed after customer left', chat.id ),
			{ meta: { event_type: 'close' } }
		) ) )
		removeOperatorsFromChat( chat )
			.catch( e => debug( 'failed to remove operator sockets from chat', chat.id, e.message ) )
	}

	const handleCloseChat = ( action ) => {
		const { chat_id, operator } = action
		let chat = getChat( chat_id, store.getState() )
		if ( !chat ) {
			chat = { id: chat_id }
		}
		operator_io.to( customerRoom( chat_id ) ).emit( 'chat.close', chat, operator )
		store.dispatch( operatorInboundMessage( chat_id, operator, merge(
			makeEventMessage( 'chat closed', chat_id ),
			{ meta: { event_type: 'close', by: action.operator } }
		) ) )
		removeOperatorsFromChat( chat )
		.then(
			() => debug( 'removed all operators from chat stream', chat_id ),
			e => debug( 'failed to remove operator sockets from chat', chat_id, e.message )
		)
	}

	const handleSetChatOperator = ( action ) => {
		let { operator, chat_id } = action
		let chat = getChat( action.chat_id, store.getState() )
		store.dispatch( operatorInboundMessage( chat.id, operator, merge(
			makeEventMessage( 'operator assigned', chat_id ),
			{ meta: { operator, event_type: 'assigned' } }
		) ) )
	}

	const handleTransferChat = ( action ) => {
		const { chat_id, toUser, user } = action
		const chat = getChat( chat_id, store.getState() )
		withTimeout( new Promise( ( resolve, reject ) => {
			if ( !toUser ) {
				return reject( new Error( 'operator not available' ) )
			}
			store.dispatch( operatorInboundMessage( chat.id, user, merge(
				makeEventMessage( 'chat transferred', chat_id ),
				{ meta: { from: user, to: toUser, event_type: 'transfer' } }
			) ) )
			emitChatOpenToOperator( chat, toUser )
			.then( resolve, reject )
		} ), timeout )
		.then(
			() => {
				store.dispatch( setChatOperator( chat.id, toUser ) )
			},
			e => {
				debug( 'failed to transfer chat', e.message )
				store.dispatch( setChatMissed( chat.id, e ) )
			}
		)
	}

	const handleAssignChat = ( action ) => {
		const { chat } = action
		debug( 'attempting to assign chat' )

		const locale = getChatLocale( chat.id, store.getState() )
		const groups = getChatGroups( chat.id, store.getState() )
		const list = getAvailableOperators( locale, groups, store.getState() )

		debug( 'chat has locale', locale, groups )

		if ( isEmpty( list ) ) {
			return store.dispatch( setChatMissed( chat.id, new Error( 'no operators available' ) ) )
		}

		const [ next ] = list

		debug( 'assigning to operator', next )
		emitChatOpenToOperator( chat, next ).then(
			() => store.dispatch( setChatOperator( chat.id, next ) ),
			e => store.dispatch( setChatMissed( chat.id, e ) )
		)
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
		// TODO: should this time out?
		// go through each chat and emit them open for the operator!
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

	const handleAssignNextChat = () => {
		if ( isAssigningChat( store.getState() ) ) {
			debug( 'already assigning chat, wait until complete' )
			return
		}

		if ( ! haveAssignableChat( store.getState() ) ) {
			// no chats waiting to be assigned
			return
		}

		const chat = getNextAssignableChat( store.getState() )
		const locale = getChatLocale( chat.id, store.getState() )
		const groups = getChatGroups( chat.id, store.getState() )

		debug( 'checking capacity to assign chat', locale, groups )

		if ( ! haveAvailableCapacity( locale, groups, store.getState() ) ) {
			// TODO: Set chat as missed and let other chats through
			debug( 'no capacity to assign chat',
				chat.id, locale, groups )
			return
		}

		store.dispatch( assignChat( chat ) )
	}

	const handleNotifiSystemStatusChange = () => {
		// get all new chats and notify their status
		debug( 'notify new chats of status' )
		compose(
			map( tap( chat => {
				customer_io
					.to( customerRoom( chat.id ) )
					.emit( 'accept', canAcceptChat( chat.id, store.getState() ) )
			} ) ),
			getAllNewChats
		)( store.getState() )
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
				handleTransferChat( action )
				return next( action )
			case OPERATOR_READY:
				handleOperatorReady( action )
				return next( action )
			case REMOVE_USER:
			case SET_USER_OFFLINE:
				handleOperatorDisconnect( action )
				return next( action )
			case CUSTOMER_INBOUND_MESSAGE:
				handleCustomerInboundMessage( action )
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
			case CUSTOMER_DISCONNECT:
				handleCustomerDisconnect( action )
				return next( action )
			case CLOSE_CHAT:
				handleCloseChat( action )
				break
			case CUSTOMER_LEFT:
				handleCustomerLeft( action )
				break
			case AUTOCLOSE_CHAT:
				handleAutocloseChat( action )
				break
		}
		const result = next( action )
		switch ( action.type ) {
			case OPERATOR_READY:
			case ASSIGN_CHAT:
				handleAssignChat( action )
				break;
			case ASSIGN_NEXT_CHAT:
				handleAssignNextChat( action )
				break
			case SET_CHAT_MISSED:
			case INSERT_PENDING_CHAT:
				store.dispatch( assignNextChat() )
				break;
		}
		return result
	}
}
