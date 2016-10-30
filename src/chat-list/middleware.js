import {
	merge,
	map
} from 'ramda'

import {
	ASSIGN_CHAT,
	ASSIGN_NEXT_CHAT,
	BROADCAST_CHATS,
	CLOSE_CHAT,
	INSERT_PENDING_CHAT,
	REASSIGN_CHATS,
	RECEIVE_CUSTOMER_MESSAGE,
	RECOVER_CHATS,
	SET_CHAT_MISSED,
	SET_CHAT_OPERATOR,
	SET_CHAT_STATUS,
	TRANSFER_CHAT,
	assignChat,
	assignNextChat,
	broadcastChats,
	closeChat,
	insertPendingChat,
	receiveCustomerMessage,
	reassignChats,
	recoverChats,
	setChatMissed,
	setChatOperator,
	setChatStatus,
	setChatsRecovered,
	setOperatorChatsAbandoned,
	transferChat
} from './actions'
import {
	getChat,
	getChatOperator,
	getChats,
	getChatsForOperator,
	getChatStatus,
	getNextMissedChat,
	getNextPendingChat,
	getOperatorAbandonedChats,
	haveMissedChat,
	havePendingChat,
	isChatStatusNew,
	isAssigningChat,
} from './selectors'
import {
	STATUS_ASSIGNED,
	STATUS_ASSIGNING,
	STATUS_CUSTOMER_DISCONNECT,
	STATUS_MISSED,
	STATUS_PENDING,
} from './reducer'
import { makeEventMessage } from '../util'

const debug = require( 'debug' )( 'happychat:chat-list:middleware' )

const timeout = ( promise, ms = 1000 ) => Promise.race( [
	promise,
	new Promise( ( resolve, reject ) => {
		setTimeout( () => reject( new Error( 'timeout' ) ), ms )
	} )
] )

const asCallback = ( resolve, reject ) => ( e, value ) => {
	if ( e ) {
		return reject( e )
	}
	resolve( value )
}

export default ( { customers, operators, events } ) => store => {
	customers.on( 'join', ( socketIdentifier, chat ) => {
		const status = getChatStatus( chat.id, store.getState() )
		if ( status === STATUS_CUSTOMER_DISCONNECT ) {
			store.dispatch( setChatStatus( chat, STATUS_ASSIGNED ) )
		}
	} )

	customers.on( 'message', ( chat, message ) => {
		store.dispatch( receiveCustomerMessage( chat, message ) )
	} )

	customers.on( 'join', ( socket, chat ) => {
		const notifyStatus = status => customers.emit( 'accept', chat, status )
		const status = getChatStatus( chat.id, store.getState() )

		if ( status === STATUS_ASSIGNED || status === STATUS_ASSIGNING ) {
			debug( 'already chatting', chat, status )
			notifyStatus( true )
			return
		}

		timeout( new Promise( ( resolve, reject ) => {
			operators.emit( 'accept', chat, asCallback( resolve, reject ) )
		} ), events._timeout )
		.then(
			canAccept => notifyStatus( canAccept ),
			e => {
				debug( 'failed to query status', e )
				notifyStatus( false )
			}
		)
	} )

	customers.on( 'disconnect', ( chat ) => {
		store.dispatch( setChatStatus( chat, STATUS_CUSTOMER_DISCONNECT ) )

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
		}, events._customerDisconnectTimeout )
	} )

	operators.on( 'init', ( { user, socket } ) => {
		// if this is an additional there will be already assigned chats
		// find them and open them on this socket
		debug( 'reassign to user?', user )
		store.dispatch( recoverChats( user, socket ) )
		store.dispatch( reassignChats( user, socket ) )
		store.dispatch( broadcastChats( socket ) )
	} )

	operators.on( 'available', () => {
		store.dispatch( assignNextChat() )
	} )

	operators.on( 'disconnect', ( operator ) => {
		debug( 'operator disconnected mark chats as abandoned' )
		store.dispatch( setOperatorChatsAbandoned( operator.id ) )
	} )

	operators.on( 'chat.join', ( chat_id, operator ) => {
		debug( 'operator joining chat', chat_id, operator )
		const chat = getChat( chat_id, store.getState() )
		const room_name = `customers/${ chat.id }`
		operators.emit( 'open', chat, room_name, operator )
		operators.emit( 'message', chat, operator, merge( makeEventMessage( 'operator joined', chat.id ), {
			meta: { operator, event_type: 'join' }
		} ) )
	} )

	operators.on( 'chat.transfer', ( chat_id, from, to ) => {
		store.dispatch( transferChat( chat_id, from, to ) )
	} )

	operators.on( 'chat.leave', ( chat_id, operator ) => {
		const chat = getChat( chat_id, store.getState() )
		const room_name = `customers/${ chat.id }`
		operators.emit( 'leave', chat, room_name, operator )
		operators.emit( 'message', chat, operator, merge( makeEventMessage( 'operator left', chat.id ), {
			meta: { operator, event_type: 'leave' }
		} ) )
	} )

	operators.on( 'chat.close', ( chat_id, operator ) => {
		store.dispatch( closeChat( chat_id, operator ) )
	} )

	const handleReceiveCustomerMessage = ( action ) => {
		debug( 'see if we should assign?', getChatStatus( action.chat.id, store.getState() ) )
		if ( isChatStatusNew( action.chat.id, store.getState() ) ) {
			store.dispatch( insertPendingChat( action.chat ) )
			return
		}
		// TODO: check if there is an operator in the room
		debug( 'chat exists time to make sure someone is home' )
	}

	const handleSetChatMissed = ( action, lastState ) => {
		let previousStatus = getChatStatus( action.chat_id, lastState )
		let missedChat = getChat( action.chat_id, store.getState() )
		if ( previousStatus !== STATUS_MISSED ) {
			debug( 'chat missed', action.chat_id, previousStatus, action.error )
			events.emit( 'miss', action.error, missedChat, previousStatus )
		}
	}

	const handleCloseChat = ( action, lastState ) => {
		let chat = getChat( action.chat_id, lastState )
		const room_name = `customers/${ chat.id }`
		operators.emit( 'close', chat, room_name, action.operator )
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

	const handleRecoverChats = ( action ) => {
		let { operator, socket } = action
		let chats = getOperatorAbandonedChats( operator.id, store.getState() )
		// TODO: should this time out?
		operators.emit( 'recover', { user: operator, socket: socket, room: `operators/${ operator.id }` }, chats, () => {
			store.dispatch( setChatsRecovered( map( ( { id } ) => id, chats ) ) )
		} )
	}

	const handleReassignChats = ( action ) => {
		const { operator, socket } = action
		debug( 'reassign', operator )
		const chats = getChatsForOperator( operator.id, store.getState() )
		debug( 'found existing chats, reassign:', operator, chats )
		operators.emit( 'reassign', operator, socket, chats )
	}

	const handleBroadcastChats = ( action ) => {
		debug( 'state', getChats( store.getState() ) )
		action.socket.emit( 'chats', getChats( store.getState() ) )
	}

	const handleTransferChat = ( action ) => {
		debug( 'time to do the transfer dance', store.getState() )
		const { chat_id, to, from } = action
		const chat = getChat( chat_id, store.getState() )
		timeout( new Promise( ( resolve, reject ) => {
			operators.emit( 'message', chat, from, merge( makeEventMessage( 'chat transferred', chat_id ), {
				meta: { from, to, event_type: 'transfer' }
			} ) )
			operators.emit( 'transfer', chat, from, to, asCallback( resolve, reject ) )
		} ), events._timeout )
		.then(
			id => {
				events.emit( 'transfer', chat, id )
			},
			e => {
				debug( 'failed to transfer chat', e )
				store.dispatch( setChatMissed( chat.id, e ) )
			}
		)
	}

	const handleAssignChat = ( action ) => {
		const { chat } = action
		const customer_room_name = `customers/${chat.id}`
		debug( 'attempting to assign chat' )
		// events.emit( 'chat.status', STATUS_ASSIGNING, chatToAssign )
		timeout( new Promise( ( resolve, reject ) => {
			operators.emit( 'assign', chat, customer_room_name, asCallback( resolve, reject ) )
		} ), events._timeout )
		.then(
			( op ) => {
				store.dispatch( setChatOperator( chat.id, op ) )
			},
			e => store.dispatch( setChatMissed( chat.id, e ) )
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
		const lastState = store.getState()
		const result = next( action )
		switch ( action.type ) {
			case RECEIVE_CUSTOMER_MESSAGE:
				handleReceiveCustomerMessage( action )
				break
			// tried to assign but couldn't
			case SET_CHAT_MISSED:
				handleSetChatMissed( action, lastState )
				break;
			case CLOSE_CHAT:
				handleCloseChat( action, lastState )
				break
			case SET_CHAT_OPERATOR:
				handleSetChatOperator( action )
				break
			case RECOVER_CHATS:
				handleRecoverChats( action )
				break;
			case REASSIGN_CHATS:
				handleReassignChats( action )
				break;
			case BROADCAST_CHATS:
				handleBroadcastChats( action )
				break
			case TRANSFER_CHAT:
				handleTransferChat( action )
				break
			case ASSIGN_CHAT:
				handleAssignChat( action )
				break
			case ASSIGN_NEXT_CHAT:
				handleAssignNextChat( action )
				break
			case SET_CHAT_STATUS:
				debug( SET_CHAT_STATUS, action.chat.id, action.status )
				events.emit( 'chat.status', action.status, action.chat )
				break
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
