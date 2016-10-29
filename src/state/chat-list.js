import {
	filter,
	compose,
	values,
	whereEq,
	lensIndex,
	lensProp,
	set,
	map,
	view,
	equals,
	dissoc,
	reduce,
	when,
	both,
	defaultTo,
	merge,
	isEmpty,
	head
} from 'ramda'

import { makeEventMessage } from '../util'

const debug = require( 'debug' )( 'happychat:chat-list:redux' )

export const STATUS_NEW = 'new'
export const STATUS_PENDING = 'pending'
export const STATUS_MISSED = 'missed'
const STATUS_ASSIGNED = 'assigned'
const STATUS_ASSIGNING = 'assigning'
export const STATUS_ABANDONED = 'abandoned'
const STATUS_CUSTOMER_DISCONNECT = 'customer-disconnect'

const BROADCAST_CHATS = 'BROADCAST_CHATS'
export const broadcastChats = ( socket ) => ( {
	type: BROADCAST_CHATS, socket
} )

const RECEIVE_CUSTOMER_MESSAGE = 'RECEIVE_CUSTOMER_MESSAGE'
export const receiveCustomerMessage = ( chat, message ) => ( {
	type: RECEIVE_CUSTOMER_MESSAGE, chat, message
} )

const ASSIGN_MISSED_CHAT = 'ASSIGN_MISSED_CHAT'
export const assignMissedChat = () => ( {
	type: ASSIGN_MISSED_CHAT
} )

const REASSIGN_CHATS = 'REASSIGN_CHATS'
export const reassignChats = ( operator, socket ) => ( {
	type: REASSIGN_CHATS, operator, socket
} )

const SET_CHATS_ABANDONED = 'SET_CHATS_ABANDONED'
export const setChatsAbandoned = ( chat_ids ) => ( {
	type: SET_CHATS_ABANDONED, chat_ids
} )

const SET_OPERATOR_CHATS_ABANDONED = 'SET_OPERATOR_CHATS_ABANDONED'
export const setOperatorChatsAbandoned = ( operator_id ) => ( {
	type: SET_OPERATOR_CHATS_ABANDONED, operator_id
} )

const RECOVER_CHATS = 'RECOVER_CHATS'
export const recoverChats = ( operator, socket ) => ( {
	type: RECOVER_CHATS, operator, socket
} )

const INSERT_PENDING_CHAT = 'INSERT_PENDING_CHAT'
export const insertPendingChat = chat => ( {
	type: INSERT_PENDING_CHAT, chat
} )

const CLOSE_CHAT = 'CLOSE_CHAT'
export const closeChat = ( chat_id, operator ) => ( {
	type: CLOSE_CHAT, chat_id, operator
} )

const SET_CHAT_STATUS = 'SET_CHAT_STATUS'
export const setChatStatus = ( chat, status ) => ( {
	type: SET_CHAT_STATUS, chat, status
} )

const SET_CHAT_MISSED = 'SET_CHAT_MISSED'
export const setChatMissed = ( chat_id, error ) => ( {
	type: SET_CHAT_MISSED, chat_id, error
} )

const SET_CHAT_OPERATOR = 'SET_CHAT_OPERATOR'
export const setChatOperator = ( chat_id, operator ) => ( {
	type: SET_CHAT_OPERATOR, chat_id, operator
} )

const TRANSFER_CHAT = 'TRANSFER_CHAT'
export const transferChat = ( chat_id, from, to ) => ( {
	type: TRANSFER_CHAT, chat_id, from, to
} )

const SET_CHATS_RECOVERED = 'SET_CHATS_RECOVERED'
const setChatsRecovered = ( chat_ids ) => ( {
	type: SET_CHATS_RECOVERED, chat_ids
} )

const ASSIGN_NEXT_CHAT = 'ASSIGN_NEXT_CHAT'
export const assignNextChat = () => ( {
	type: ASSIGN_NEXT_CHAT
} )

const ASSIGN_CHAT = 'ASSIGN_CHAT'
const assignChat = chat => ( {
	type: ASSIGN_CHAT, chat
} )

const statusLens = lensIndex( 0 )
const chatLens = lensIndex( 1 )
const operatorLens = lensIndex( 2 )

const statusView = view( statusLens )
const chatView = view( chatLens )
const operatorView = view( operatorLens )

const setStatus = set( statusLens )
const setChat = set( chatLens )
const setOperator = set( operatorLens )

const mapToChat = map( chatView )

const matchingStatus = status => filter( compose( equals( status ), statusView ) )

/*
Selects all chats assigned/associated with given operator id
*/
export const getChatsForOperator = ( operator_id, state ) => compose(
	// take the 2nd item (the chat)
	mapToChat,
	// filter the values of chat
	filter( compose(
		// compare operator.id to operator_id and match when equal
		whereEq( { id: operator_id } ),
		defaultTo( {} ),
		// take the 3rd item in chat row [STATUS, CHAT, OPERATOR]
		operatorView
	) ),
	// get the values of chat
	values
)( state )

export const getAllChats = compose( mapToChat, values )
export const getChatsWithStatus = ( status, state ) => compose(
	mapToChat,
	matchingStatus( status ),
	values
)( state )

export const getOperatorAbandonedChats = ( id, state ) => compose(
	mapToChat,
	filter( both(
		compose( whereEq( { id } ), defaultTo( {} ), operatorView ),
		compose( equals( STATUS_ABANDONED ), statusView )
	) ),
	values
)( state )

export const getAbandonedChats = ( state ) => getChatsWithStatus( STATUS_ABANDONED, state )
export const getMissedChats = ( state ) => getChatsWithStatus( STATUS_MISSED, state )

export const getChatOperator = ( chat_id, state ) => compose(
	operatorView,
	defaultTo( [] ),
	view( lensProp( chat_id ) )
)( state )

export const getChat = ( chat_id, state ) => compose(
	chatView,
	defaultTo( [] ),
	view( lensProp( chat_id ) )
)( state )

export const getChats = state => compose(
	mapToChat,
	values
)( state )

export const getChatStatus = ( chat_id, state ) => defaultTo( STATUS_NEW )( compose(
	statusView,
	defaultTo( [] ),
	view( lensProp( chat_id ) )
)( state ) )

export const isChatStatusNew = ( chat_id, state ) => equals( STATUS_NEW, getChatStatus( chat_id, state ) )

export const haveChatWithStatus = ( status, state ) => ! isEmpty(
	getChatsWithStatus( status, state )
)

export const havePendingChat = state => haveChatWithStatus( STATUS_PENDING, state )
const getNextPendingChat = state => head(
	getChatsWithStatus( STATUS_PENDING, state )
)

export const haveMissedChat = state => haveChatWithStatus( STATUS_MISSED, state )
const getNextMissedChat = state => head(
	getChatsWithStatus( STATUS_MISSED, state )
)

const isAssigningChat = state => haveChatWithStatus( STATUS_ASSIGNING, state )

const chat = ( state = [ null, null, null ], action ) => {
	switch ( action.type ) {
		case INSERT_PENDING_CHAT:
			return compose(
				setStatus( STATUS_PENDING ),
				setChat( action.chat )
			)( state )
		case SET_CHAT_OPERATOR:
			return compose(
				setStatus( STATUS_ASSIGNED ),
				setOperator( action.operator )
			)( state )
		case SET_CHAT_STATUS:
			return setStatus( action.status, state )
		case SET_CHATS_ABANDONED:
		case SET_OPERATOR_CHATS_ABANDONED:
			return setStatus( STATUS_ABANDONED, state )
		case SET_CHATS_RECOVERED:
			return setStatus( STATUS_ASSIGNED, state )
		case ASSIGN_CHAT:
			return setStatus( STATUS_ASSIGNING, state )
		case SET_CHAT_MISSED:
			return setStatus( STATUS_MISSED, state )
	}
	return state
}

const whereOperatorIs = id => compose(
	whereEq( { id } ),
	defaultTo( {} ),
	operatorView
)

const whenOperatorIs = id => when( whereOperatorIs( id ) )

export const reducer = ( state = {}, action ) => {
	switch ( action.type ) {
		case SET_CHAT_MISSED:
		case SET_CHAT_OPERATOR:
			const chatIdLens = lensProp( action.chat_id )
			return set( chatIdLens, chat( view( chatIdLens, state ), action ) )( state )
		case SET_CHAT_STATUS:
		case INSERT_PENDING_CHAT:
		case ASSIGN_CHAT:
			const lens = lensProp( action.chat.id )
			return set( lens, chat( view( lens, state ), action ) )( state )
		case CLOSE_CHAT:
			return dissoc( action.chat_id, state )
		case SET_CHATS_ABANDONED:
		case SET_CHATS_RECOVERED:
			return reduce(
				( chats, chat_id ) => set(
					lensProp( chat_id ),
					chat( view( lensProp( chat_id ), chats ), action ),
					chats
				),
				state,
				action.chat_ids
			)
		case SET_OPERATOR_CHATS_ABANDONED:
			return map(
				whenOperatorIs( action.operator_id )( value => chat( value, action ) )
			)( state )

	}
	return state
}

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
