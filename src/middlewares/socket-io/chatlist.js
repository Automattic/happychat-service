import {
	merge,
	map,
	ifElse,
	isEmpty,
	view,
	lensPath
} from 'ramda'

import {
	OPERATOR_READY,
	OPERATOR_CHAT_JOIN,
	OPERATOR_CHAT_LEAVE,
	OPERATOR_CHAT_TRANSFER,
	OPERATOR_CHAT_CLOSE
} from './index'
import {
	ASSIGN_CHAT,
	ASSIGN_NEXT_CHAT,
	CLOSE_CHAT,
	INSERT_PENDING_CHAT,
	REASSIGN_CHATS,
	RECEIVE_CUSTOMER_MESSAGE,
	RECOVER_CHATS,
	SET_CHAT_MISSED,
	SET_CHAT_OPERATOR,
	SET_CHAT_CUSTOMER_DISCONNECT,
	NOTIFY_SYSTEM_STATUS_CHANGE,
	NOTIFY_CHAT_STATUS_CHANGED,
	assignChat,
	assignNextChat,
	closeChat,
	insertPendingChat,
	receiveCustomerMessage,
	reassignChats,
	recoverChats,
	setChatMissed,
	setChatOperator,
	setChatsRecovered,
	setOperatorChatsAbandoned,
	setChatCustomerDisconnect,
} from '../../chat-list/actions'
import {
	getChat,
	getChatOperator,
	getChatsForOperator,
	getChatStatus,
	getNextMissedChat,
	getNextPendingChat,
	getOperatorAbandonedChats,
	haveMissedChat,
	havePendingChat,
	isChatStatusNew,
	isAssigningChat,
} from '../../chat-list/selectors'
import {
	STATUS_CUSTOMER_DISCONNECT,
	STATUS_MISSED,
	STATUS_PENDING,
} from '../../chat-list/reducer'
import {
	REMOVE_USER,
	operatorChatClose,
} from '../../operator/actions'
import {
	isSystemAcceptingCustomers,
	getAvailableOperators
} from '../../operator/selectors'
import { makeEventMessage, onConnection, timestamp } from '../../util'

const debug = require( 'debug' )( 'happychat:middleware:chat-list' )

const chatRoomId = id => `session/${id}`
const chatRoom = ( { id } ) => chatRoomId( id )

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
		debug( 'starting timeout timer', ms )
		setTimeout( () => reject( new Error( 'timeout' ) ), ms )
	} )
] )

const customerRoom = ( { session_id } ) => `session/${ session_id }`

const init = ( { user, socket, events, io, } ) => () => {
	const socketIdentifier = { id: user.id, socket_id: socket.id, session_id: user.session_id }
	const chat = {
		user_id: user.id,
		id: user.session_id,
		username: user.username,
		name: user.name,
		picture: user.picture
	}

	debug( 'chat initialized', chat )

	socket.on( 'message', ( { text, id, meta } ) => {
		const message = { session_id: chat.id, id: id, text, timestamp: timestamp(), user: identityForUser( user ), meta }
		debug( 'received customer message', message )
		// all customer connections for this user receive the message
		// io.to( user.id ).emit( 'message', message )
		events.emit( 'message', chat, message )
	} )

	socket.on( 'typing', ( text ) => {
		events.emit( 'typing', chat, user, text );
	} )

	socket.on( 'disconnect', () => {
		debug( 'socket.on.disconnect', user.id, socketIdentifier );

		events.emit( 'disconnect-socket', { socketIdentifier, user, chat, socket } )

		whenNoClients( io, chatRoom( chat ) )
			.then( () => {
				events.emit( 'disconnect', chat, user )
			} )
	} )

	socket.emit( 'init', user )
	events.emit( 'join', socketIdentifier, chat, socket )
}

const join = ( { events, io, user, socket } ) => {
	debug( 'user joined', user )
	socket.join( customerRoom( user ), init( { user, socket, events, io } ) )
}

const getClients = ( server, room ) => new Promise( ( resolve, reject ) => {
	room.clients( ( e, ids ) => {
		if ( e ) {
			return reject( e )
		}
		resolve( map( id => server.connected[id], ids ) )
	} )
} )

export default ( { io, customers, operators, events, timeout = 1000, customerDisconnectTimeout = 90000 } ) => store => {
	const operator_io = io.of( '/operator' )
	const customer_io = io.of( '/customer' )
	.on( 'connection', socket => {
		debug( 'customer connecting' )
		onConnection(
			{ socket, events: customers },
			user => join( { socket, events: customers, user, io: customer_io } )
		)
	} )

	const removeOperatorFromChat = ( operator, chat ) => {
		const customer_room_name = `customers/${chat.id}`
		const room = operator_io.in( `operators/${operator.id}` )
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
			room.emit( 'chat.leave', chat )
			resolve( { chat, operator } )
		} ) )
	}

	const emitChatOpenToOperator = ( chat, operator ) => {
		const customer_room_name = `customers/${chat.id}`
		const room = operator_io.in( `operators/${operator.id}` )
		return getClients( operator_io, room )
		.then( clients => Promise.all(
			map( socket => new Promise( ( resolve, reject ) => {
				socket.join( customer_room_name, ( error ) => {
					if ( error ) return reject( error )
					debug( 'joined the room', customer_room_name )
					resolve( socket )
					operators.emit( 'join', chat, operator, socket )
				} )
			} ), clients )
		) )
		.then( ( clients ) => new Promise( resolve => {
			debug( 'opening chat for clients', clients.length )
			room.emit( 'chat.open', chat )
			resolve( { chat, operator } )
		} ) )
	}

	customers.on( 'receive', ( chat, message ) => {
		debug( 'sending message to customer', chat.id, message.text )
		customer_io.to( chatRoom( chat ) ).emit( 'message', message )
	} )

	customers.on( 'receive.typing', ( chat, user, text ) => {
		// customers shouldn't know who is typing or what they're typing
		customer_io.to( chatRoom( chat ) ).emit( 'typing', text && !isEmpty( text ) )
	} )

	customers.on( 'accept', ( accepted ) => {
		customer_io.emit( 'accept', accepted )
	} )

	customers.on( 'join', ( socketIdentifier, chat ) => {
		const state = store.getState()
		const status = getChatStatus( chat.id, state )
		const operator = getChatOperator( chat.id, state )
		if ( operator && !isEmpty( operator ) && status === STATUS_CUSTOMER_DISCONNECT ) {
			store.dispatch( setChatOperator( chat.id, operator ) )
			return
		}
	} )

	const whenChatExists = ( success, failure = () => {} ) => ( chat_id, operator ) => ifElse(
		chat => !! chat,
		chat => success( chat, operator ),
		() => failure( chat_id, operator )
	)( getChat( chat_id, store.getState() ) )

	customers.on( 'message', ( chat, message ) => {
		store.dispatch( receiveCustomerMessage( chat, message ) )
	} )

	customers.on( 'join', ( socketid, chat, socket ) => {
		// when a customer joins inform of status update
		socket.emit( 'accept', isSystemAcceptingCustomers( store.getState() ) )
	} )

	customers.on( 'disconnect', ( chat ) => {
		if ( isChatStatusNew( chat.id, store.getState() ) ) {
			debug( 'Customer disconnected without starting chat', chat.id )
			return;
		}
		store.dispatch( setChatCustomerDisconnect( chat.id ) )
		setTimeout( () => {
			const status = getChatStatus( chat.id, store.getState() )
			if ( status !== STATUS_CUSTOMER_DISCONNECT ) {
				return
			}

			const operator = getChatOperator( chat.id, store.getState() )
			operators.emit( 'message', chat, operator,
				merge( makeEventMessage( 'customer left', chat.id ), {
					meta: { event_type: 'customer-leave' }
				} )
			)
		}, customerDisconnectTimeout )
	} )

	const handleOperatorReady = ( { user, socket } ) => {
		store.dispatch( recoverChats( user, socket ) )
		store.dispatch( reassignChats( user, socket ) )
	}

	const handleOperatorDisconnect = action => {
		debug( 'operator disconnected mark chats as abandoned' )
		store.dispatch( setOperatorChatsAbandoned( action.user.id ) )
	}

	const handleOperatorChatJoin = action => whenChatExists( ( chat, operator ) => {
		debug( 'operator joining chat', chat.id, operator )
		emitChatOpenToOperator( chat, operator )
		// TODO: send a message over dispatch
		operators.emit( 'message', chat, operator, merge( makeEventMessage( 'operator joined', chat.id ), {
			meta: { operator, event_type: 'join' }
		} ) )
	}, chat_id => debug( 'chat.join without existing chat', chat_id ) )( action.chat_id, action.user )

	const handleOperatorChatLeave = action => whenChatExists( ( chat, operator ) => {
		// operators.emit( 'leave', chat, room_name, operator )
		// store.dispatch( operatorLeave( chat, room_name, operator ) )
		// remove all operator clients from the room
		removeOperatorFromChat( operator, chat )
		.then(
			() => {
				// send redux action to update loads
				debug( 'removed operator from chat', operator.id )
				operators.emit( 'message', chat, operator, merge( makeEventMessage( 'operator left', chat.id ), {
					meta: { operator, event_type: 'leave' }
				} ) )
			},
			e => debug( 'failed to remove operator from chat', e )
		)
	}, chat_id => debug( 'chat.leave without existing chat', chat_id ) )( action.chat_id, action.user )

	const handleOperatorCloseChat = action => whenChatExists( ( chat, operator ) => {
		store.dispatch( closeChat( chat.id, operator ) )
	}, chat_id => debug( 'chat.close without existing chat', chat_id ) )( action.chat_id, action.user )

	const handleReceiveCustomerMessage = ( { chat } ) => {
		const state = store.getState()
		debug( 'see if we should assign?', getChatStatus( chat.id, state ) )
		const operator = getChatOperator( chat.id, state )
		const isNew = isChatStatusNew( chat.id, state )
		if ( !operator || isNew ) {
			store.dispatch( insertPendingChat( chat ) )
			return
		}
		// TODO: check if there is an operator in the room
		debug( 'chat exists time to make sure someone is home' )
	}

	const handleSetChatMissed = ( action, lastState ) => {
		let previousStatus = getChatStatus( action.chat_id, lastState )
		let missedChat = getChat( action.chat_id, store.getState() )
		if ( previousStatus !== STATUS_MISSED ) {
			debug( 'chat missed', action.chat_id, previousStatus, action.error.message )
			events.emit( 'miss', action.error, missedChat, previousStatus )
		}
	}

	const handleCloseChat = ( action, lastState ) => {
		let chat = getChat( action.chat_id, lastState )
		store.dispatch( operatorChatClose( chat, action.operator ) )
		operators.emit( 'message', chat, action.operator, merge( makeEventMessage( 'chat closed', chat.id ), {
			meta: { event_type: 'close', by: action.operator }
		} ) )
	}

	const handleSetChatOperator = ( action ) => {
		let { operator, chat_id } = action
		let chat = getChat( action.chat_id, store.getState() )
		events.emit( 'found', chat, operator )
		operators.emit( 'message', chat, operator, merge( makeEventMessage( 'operator assigned', chat_id ), {
			meta: { operator, event_type: 'assigned' }
		} ) )
	}

	const handleTransferChat = ( action ) => {
		debug( 'time to do the transfer dance', action, store.getState() )
		const { chat_id, toUser, user } = action
		const chat = getChat( chat_id, store.getState() )
		withTimeout( new Promise( ( resolve, reject ) => {
			if ( !toUser ) {
				return reject( new Error( 'operator not available' ) )
			}
			operators.emit( 'message', chat, user, merge( makeEventMessage( 'chat transferred', chat_id ), {
				meta: { from: user, to: toUser, event_type: 'transfer' }
			} ) )
			emitChatOpenToOperator( chat, toUser )
			.then( resolve, reject )
		} ), timeout )
		.then(
			() => {
				store.dispatch( setChatOperator( chat.id, toUser ) )
			},
			e => {
				debug( 'failed to transfer chat', e )
				store.dispatch( setChatMissed( chat.id, e ) )
			}
		)
	}

	const handleAssignChat = ( action ) => {
		const { chat } = action
		debug( 'attempting to assign chat' )

		const list = getAvailableOperators( store.getState() )
		debug( 'anyone home?', list, JSON.stringify( store.getState().operators.identities, null, '  ' ) )
		if ( isEmpty( list ) ) {
			return store.dispatch( setChatMissed( chat.id, new Error( 'no operators available' ) ) )
		}

		// TODO: assign to next operator on failure
		const [ next, ... rest] = list

		// TODO: timeout?
		emitChatOpenToOperator( chat, next ).then(
			() => store.dispatch( setChatOperator( chat.id, next ) ),
			e => store.dispatch( setChatMissed( chat.id, e ) )
		)
	}

	const handleReassignChats = ( action ) => {
		const { operator } = action
		debug( 'reassign', operator.id )
		const chats = getChatsForOperator( operator.id, store.getState() )
		debug( 'reassign existing chants to operator', operator.id )
		Promise.all( map(
			chat => emitChatOpenToOperator( chat, operator ),
			chats
		) )
		.then(
			// NOTE: this may cause existing clients to get notifications of chat.open
			( result ) => debug( 'Reassigned', result.length, 'to operator client', operator.id ),
			e => debug( 'failed to reassign chats to operator', operator.id, e )
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
			e => debug( 'Failed to recover chats for operator', operator.id, e )
		)
	}

	const handleAssignNextChat = () => {
		if ( isAssigningChat( store.getState() ) ) {
			debug( 'aready assigning chat, wait until complete' )
			return
		}

		if ( haveMissedChat( store.getState() ) ) {
			debug( 'assign missed chat' )
			store.dispatch( assignChat( getNextMissedChat( store.getState() ) ) )
			return
		}

		if ( havePendingChat( store.getState() ) ) {
			debug( 'assign pending chat' )
			store.dispatch( assignChat( getNextPendingChat( store.getState() ) ) )
			return
		}

		debug( 'no chats to assign' )
	}

	return next => action => {
		debug( 'received', action.type )
		switch ( action.type ) {
			case NOTIFY_SYSTEM_STATUS_CHANGE:
				debug( 'NOTIFY_SYSTEM_STATUS_CHANGE', action.enabled )
				customer_io.emit( 'accept', action.enabled )
				break;
			case NOTIFY_CHAT_STATUS_CHANGED:
				debug( 'NOTIFY_CHAT_STATUS_CHANGED', action.chat_id )
				const status = getChatStatus( action.chat_id, store.getState() );
				customer_io.in( chatRoomId( action.chat_id ) ).emit( 'status', status )
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
			case OPERATOR_CHAT_CLOSE:
				handleOperatorCloseChat( action )
				return next( action )
			case OPERATOR_READY:
				handleOperatorReady( action )
				return next( action )
			case REMOVE_USER:
				handleOperatorDisconnect( action )
				return next( action )
			case RECEIVE_CUSTOMER_MESSAGE:
				handleReceiveCustomerMessage( action )
				return next( action )
			case SET_CHAT_OPERATOR:
				handleSetChatOperator( action )
				return next( action )
		}
		const lastState = store.getState()
		const result = next( action )
		switch ( action.type ) {
			// tried to assign but couldn't
			case SET_CHAT_MISSED:
				handleSetChatMissed( action, lastState )
				return next( action );
			case CLOSE_CHAT:
				handleCloseChat( action, lastState )
				break
			case OPERATOR_READY:
			case ASSIGN_CHAT:
				handleAssignChat( action )
				break;
			case ASSIGN_NEXT_CHAT:
				handleAssignNextChat( action )
				break
			case SET_CHAT_CUSTOMER_DISCONNECT:
				events.emit( 'chat.status', STATUS_CUSTOMER_DISCONNECT, getChat( action.chat_id, store.getState() ) )
				break;
			case INSERT_PENDING_CHAT:
				events.emit( 'chat.status', STATUS_PENDING, action.chat )
				store.dispatch( assignNextChat() )
				break;
			default:
				debug( 'default for action', action.type )
		}
		return result
	}
}
