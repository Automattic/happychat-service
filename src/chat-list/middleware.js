import {
	merge,
	map,
	lensProp
} from 'ramda'

import {
	ASSIGN_CHAT,
	ASSIGN_MISSED_CHAT,
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
	insertPendingChat,
	setChatMissed,
	setChatOperator,
	setChatsRecovered
} from './actions'
import {
	getChat,
	getChats,
	getChatsForOperator,
	getChatStatus,
	getNextMissedChat,
	getNextPendingChat,
	getOperatorAbandonedChats,
	haveMissedChat,
	havePendingChat,
	isChatStatusNew,
	isAssigningChat
} from './selectors'
import {
	STATUS_MISSED,
	STATUS_PENDING
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

export const middleware = ( { customers, operators, events } ) => store => {
	return next => action => {
		debug( 'received', action.type )
		const prevState = store.getState()
		const result = next( action )
		switch ( action.type ) {
			case RECEIVE_CUSTOMER_MESSAGE:
				debug( 'see if we should assign?', getChatStatus( action.chat.id, store.getState() ) )
				// select status of chat
				if ( isChatStatusNew( action.chat.id, store.getState() ) ) {
					store.dispatch( insertPendingChat( action.chat ) )
					break
				}
				debug( 'chat exists time to make sure someone is home' )
				break
			// tried to assign but couldn't
			case SET_CHAT_MISSED:
				let previousStatus = getChatStatus( action.chat_id, prevState )
				let missedChat = getChat( action.chat_id, store.getState() )
				if ( previousStatus !== STATUS_MISSED ) {
					debug( 'chat missed', action.chat_id, previousStatus, action.error )
					events.emit( 'miss', action.error, missedChat, previousStatus )
				}
				// const [ status ] = get( this._chats, chat.id, [] );
				// this._chats = set( this._chats, chat.id, [ STATUS_MISSED, chat ] )
				// if ( status !== STATUS_MISSED ) {
				// 	this.emit( 'miss', error, chat )
				// }
				break;
			case CLOSE_CHAT:
				let closedChat = getChat( action.chat_id, prevState )
				const room_name = `customers/${ closedChat.id }`
				operators.emit( 'close', closedChat, room_name, action.operator )
				operators.emit( 'message', closedChat, action.operator, merge( makeEventMessage( 'chat closed', closedChat.id ), {
					meta: { event_type: 'close', by: action.operator }
				} ) )
				break
			case SET_CHAT_OPERATOR:
				let { operator, chat_id } = action
				let chatToUpdate = getChat( action.chat_id, store.getState() )
				events.emit( 'chat.status', 'found', chatToUpdate, operator )
				events.emit( 'found', chatToUpdate, operator )
				operators.emit( 'message', chatToUpdate, operator, merge( makeEventMessage( 'operator assigned', chat_id ), {
					meta: { operator, event_type: 'assigned' }
				} ) )
				break
			case RECOVER_CHATS:
				let { operator: recoverOperator, socket: recoverSocket } = action
				let abandonedChats = getOperatorAbandonedChats( recoverOperator.id, store.getState() )
				// TODO: should this time out?
				operators.emit( 'recover', { user: recoverOperator, socket: recoverSocket, room: `operators/${ recoverOperator.id }` }, abandonedChats, () => {
					store.dispatch( setChatsRecovered( map( lensProp( 'id' ), abandonedChats ) ) )
				} )
				break;
			case REASSIGN_CHATS:
				const { operator: reassignOperator, socket } = action
				debug( 'reassign', reassignOperator )
				const chats = getChatsForOperator( reassignOperator.id, store.getState() )
				debug( 'found existing chats, reassign:', reassignOperator, chats )
				operators.emit( 'reassign', reassignOperator, socket, chats )
				break;
			case BROADCAST_CHATS:
				debug( 'state', getChats( store.getState() ) )
				action.socket.emit( 'chats', getChats( store.getState() ) )
				break
			case TRANSFER_CHAT:
				debug( 'time to do the transfer dance', store.getState() )
				const { chat_id: transfer_chat_id, to, from } = action
				const toTransferChat = getChat( transfer_chat_id, store.getState() )
				timeout( new Promise( ( resolve, reject ) => {
					operators.emit( 'message', toTransferChat, from, merge( makeEventMessage( 'chat transferred', transfer_chat_id.id ), {
						meta: { from, to, event_type: 'transfer' }
					} ) )
					operators.emit( 'transfer', toTransferChat, from, to, asCallback( resolve, reject ) )
				} ), events._timeout )
				.then(
					id => {
						events.emit( 'transfer', toTransferChat, id )
					},
					e => {
						debug( 'failed to transfer chat', e )
						store.dispatch( setChatMissed( toTransferChat.id, e ) )
					}
				)
				break
			case ASSIGN_CHAT:
				const chatToAssign = action.chat
				const customer_room_name = `customers/${chatToAssign.id}`
				debug( 'attempting to assign chat' )
				// events.emit( 'chat.status', STATUS_ASSIGNING, chatToAssign )
				timeout( new Promise( ( resolve, reject ) => {
					operators.emit( 'assign', chatToAssign, customer_room_name, asCallback( resolve, reject ) )
				} ) )
				.then(
					( op ) => {
						store.dispatch( setChatOperator( chatToAssign.id, op ) )
					},
					e => store.dispatch( setChatMissed( chatToAssign.id, e ) )
				)
				break
			case ASSIGN_NEXT_CHAT:
				if ( isAssigningChat( store.getState() ) ) {
					debug( 'aready assigning chat, wait until complete' )
					break;
				}

				if ( haveMissedChat( store.getState() ) ) {
					debug( 'assign missed chat' )
					store.dispatch( assignChat( getNextMissedChat( store.getState() ) ) )
				}

				if ( havePendingChat( store.getState() ) ) {
					debug( 'assign pending chat' )
					store.dispatch( assignChat( getNextPendingChat( store.getState() ) ) )
					break;
				}

				debug( 'no chats to assign' )
				break
			case ASSIGN_MISSED_CHAT:
				store.dispatch( assignNextChat() )
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
