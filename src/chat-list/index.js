import { EventEmitter } from 'events'
import assign from 'lodash/assign'
import values from 'lodash/values'
import filter from 'lodash/filter'
import map from 'lodash/map'
import { makeEventMessage } from '../util'
import { createStore, applyMiddleware } from 'redux'
import {
	reducer,
	STATUS_NEW
} from './reducer'
import {
	middleware
} from './middleware'
import {
	getChat,
	getChatOperator,
	getChatStatus,
	getChats,
} from './selectors'
import {
	broadcastChats,
	insertPendingChat,
	setChatMissed,
	setChatStatus,
	assignNextChat,
	setOperatorChatsAbandoned,
	reassignChats,
	recoverChats,
	receiveCustomerMessage,
	closeChat,
	transferChat
} from './actions'

const STATUS_ASSIGNED = 'assigned'
const STATUS_CUSTOMER_DISCONNECT = 'customer-disconnect'

const debug = require( 'debug' )( 'happychat:chat-list' )

const promiseTimeout = ( promise, ms = 1000 ) => new Promise( ( resolve, reject ) => {
	const id = setTimeout( () => reject( new Error( 'timeout' ) ), ms );
	const clear = () => clearTimeout( id )
	promise.then( ( value ) => {
		clear()
		resolve( value )
	}, ( error ) => {
		clear()
		reject( error );
	} )
} )

const asCallback = ( resolve, reject ) => ( e, value ) => {
	if ( e ) return reject( e );
	resolve( value );
}

export class ChatList extends EventEmitter {

	constructor( { customers, operators, timeout = 1000, customerDisconnectTimeout = 90000, state = undefined } ) {
		super()

		// A single store of chats including:
		// 1) a chat's status (pending, assigned, abandoned, missed)
		// 2) the chat identity (user/chat_id)
		// 3) the assigned operator identity
		// this._chats = {}
		this.store = createStore( reducer, state, applyMiddleware( middleware( { customers, operators, events: this } ) ) )

		// Default timeout for querying operator clients for information
		this._timeout = timeout
		this._customerDisconnectTimeout = customerDisconnectTimeout

		// event and io for customer and operator connections
		this.customers = customers
		this.operators = operators

		customers.on( 'join', ( socketIdentifier, chat ) => {
			const status = this.getChatStatus( chat )
			if ( status === STATUS_CUSTOMER_DISCONNECT ) {
				this.setChatStatus( chat, STATUS_ASSIGNED )
			}
		} )

		customers.on( 'message', ( ... args ) => {
			this.onCustomerMessage( ... args )
		} )

		customers.on( 'join', ( ... args ) => this.onCustomerJoin( ... args ) )

		customers.on( 'disconnect', ( chat ) => {
			this.setChatStatus( chat, STATUS_CUSTOMER_DISCONNECT )

			setTimeout( () => {
				const status = this.getChatStatus( chat )
				if ( status !== STATUS_CUSTOMER_DISCONNECT ) {
					return
				}

				this.findChatOperator( chat.id )
					.then( ( operator ) => {
						operators.emit( 'message', chat, operator,
							assign( makeEventMessage( 'customer left', chat.id ), {
								meta: { event_type: 'customer-leave' }
							} )
						)
					} )
					.catch( e => {
						debug( 'failed to message op about customer disconnect', e, chat )
					} )
			}, this._customerDisconnectTimeout )
		} )

		operators.on( 'init', ( init ) => {
			this.onOperatorConnected( init )
		} )

		operators.on( 'available', () => {
			this.store.dispatch( assignNextChat() )
		} )

		// All clients of a single operator are offline
		// mark their chats as abandoned
		operators.on( 'disconnect', ( operator ) => {
			debug( 'operator disconnected mark chats as abandoned' )
			this.store.dispatch( setOperatorChatsAbandoned( operator.id ) )
			// this.findOperatorChats( operator )
			// .then( ( chats ) => {
			// 	this._chats = assign( {}, this._chats, reduce( chats, ( abandoned, chat ) => {
			// 		return set( abandoned, chat.id, [ STATUS_ABANDONED, chat, operator ] )
			// 	}, {} ) )
			// 	debug( '_chats updated', this._chats )
			// } )
		} )

		operators.on( 'chat.join', ( chat_id, operator ) => {
			debug( 'operator joining chat', chat_id, operator )
			this.findChatById( chat_id )
			.then( ( chat ) => {
				const room_name = `customers/${ chat.id }`
				operators.emit( 'open', chat, room_name, operator )
				operators.emit( 'message', chat, operator, assign( makeEventMessage( 'operator joined', chat.id ), {
					meta: { operator, event_type: 'join' }
				} ) )
			} )
			.catch( () => {
				debug( 'failed to find chat', chat_id )
			} )
		} )

		operators.on( 'chat.transfer', ( chat_id, from, to ) => {
			this.store.dispatch( transferChat( chat_id, from, to ) )
			// debug( 'transfer chat', chat_id, from, to )
			// this.findChatById( chat_id )
			// .then( ( chat ) => {
			// 	return this.findChatOperator( chat_id )
			// 	.then( ( op ) => promiseTimeout( new Promise( ( resolve, reject ) => {
			// 		if ( op && op.id !== from.id ) {
			// 			throw new Error( 'Assigning operator does not match assigned operator' )
			// 		}
			// 		operators.emit( 'transfer', chat, op, to, asCallback( resolve, reject ) )
			// 		operators.emit( 'message', chat, from, assign( makeEventMessage( 'chat transferred', chat.id ), {
			// 			meta: { from, to, event_type: 'transfer' }
			// 		} ) )
			// 	} ), this._timeout ) )
			// 	.then( op => this.setChatAsAssigned( chat, op ) )
			// 	.then( op => this.emit( 'transfer', chat, op ) )
			// 	.catch( e => {
			// 		debug( 'failed to transfer chat', e, chat )
			// 		this.setChatAsMissed( chat, e )
			// 	} )
			// } )
			// .catch( e => debug( 'chat does not exist', e ) )
		} )

		operators.on( 'chat.leave', ( chat_id, operator ) => {
			this.findChatById( chat_id )
			.then( ( chat ) => {
				const room_name = `customers/${ chat.id }`
				operators.emit( 'leave', chat, room_name, operator )
				operators.emit( 'message', chat, operator, assign( makeEventMessage( 'operator left', chat.id ), {
					meta: { operator, event_type: 'leave' }
				} ) )
			} )
			.catch( e => debug( 'Chat does not exist', chat_id, e ) )
		} )

		operators.on( 'chat.close', ( chat_id, operator ) => {
			this.store.dispatch( closeChat( chat_id, operator ) )
		} )
	}

	onOperatorConnected( { user, socket, room } ) {
		const { id } = user

		// if this is an additional there will be already assigned chats
		// find them and open them on this socket
		debug( 'reassign to user?', user )
		this.store.dispatch( recoverChats( user, socket ) )
		this.store.dispatch( reassignChats( user, socket ) )

		// find all chats abandoned by operator and re-assign them
		// this.findAbandonedChats( id )
		// .then( ( chats ) => {
		// 	debug( 'attempt to recover chats', chats, id )
		// 	this.operators.emit( 'recover', { user, socket, room }, chats, () => {
		// 		this._chats = assign( {}, this._chats, reduce( chats, ( recovered, chat ) => {
		// 			return set( recovered, chat.id, [ STATUS_ASSIGNED, chat, user ] )
		// 		}, {} ) )
		// 		debug( 'recovered _chats', this._chats )
		// 	} )
		// } )
		// .catch( ( e ) => {
		// 	debug( 'failed to search chats', e )
		// } )

		this.store.dispatch( broadcastChats( socket ) )
		// get a list of all open chats and send to operator
		// this.store.dispatch( broadcastChats() )
		// this.findAllOpenChats()
		// .then( ( chats ) => {
		// 	socket.emit( 'chats', chats )
		// } )
	}

	// queryClientAssignment( channelIdentity, room_name ) {
	// 	return promiseTimeout( new Promise( ( resolve, reject ) => {
	// 		this.operators.emit( 'assign', channelIdentity, room_name, asCallback( resolve, reject ) )
	// 	} ), this._timeout )
	// }

	// setChatAsAssigned( chat, operator ) {
	// 	this._chats = set( this._chats, chat.id, [ STATUS_ASSIGNED, chat, operator ] )
	// 	return Promise.resolve( operator )
	// }

	onCustomerJoin( socketIdentifier, chat ) {
		// find the chat
		const notifyStatus = status => this.customers.emit( 'accept', chat, status )
		this.findChat( chat )
		.then( () => {
			const chatStatus = this.getChatStatus( chat )
			debug( 'found chat', chatStatus )

			if ( chatStatus !== STATUS_NEW ) {
				debug( 'already chatting', chat, chatStatus )
				notifyStatus( true )
				return
			}

			promiseTimeout( new Promise( ( resolve, reject ) => {
				this.operators.emit( 'accept', chat, asCallback( resolve, reject ) )
			} ), this._timeout )
			.then(
				status => notifyStatus( status ),
				e => {
					debug( 'failed to query status', e )
					notifyStatus( false )
				}
			)
		} )
	}

	onCustomerMessage( channelIdentity, message ) {
		// TODO: make a queue and only assign one at a time?
		this.store.dispatch( receiveCustomerMessage( channelIdentity, message ) )
		// const { id } = channelIdentity
		// const room_name = `customers/${ id }`
		// this.findChat( channelIdentity )
		// .then( chat => new Promise( ( resolve, reject ) => {
		// 	// are there any operators in the room?
		// 	this.operators.io.in( room_name ).clients( ( e, clients ) => {
		// 		if ( e ) {
		// 			debug( 'failed to query clients', e )
		// 			return reject( e )
		// 		}
		// 		if ( clients.length === 0 ) {
		// 			debug( 'no operators', chat )
		// 			return reject( new Error( 'channel has no operator' ) )
		// 		}
		// 		resolve( chat )
		// 	} )
		// } ) )
		// .then( ( chat ) => {
		// 	debug( 'chat already managed', chat.id )
		// } )
		// .catch( () => {
		// 	debug( 'chat has not been assigned, finding an operator', channelIdentity.id, room_name )
		// 	let chat = this.insertPendingChat( channelIdentity )
		// 	this.emit( 'chat.status', 'pending', chat )
		//
		// 	this.queryClientAssignment( chat, room_name )
		// 	// .then( operator => this.setChatAsAssigned( chat, operator ) )
		// 	.then( operator => {
		// 		this.store.dispatch( setChatOperator( chat.id, operator ) )
		// 	} )
		// 	.catch( ( assignmentError ) => {
		// 		debug( 'failed to find operator', assignmentError, channelIdentity )
		// 		this.setChatAsMissed( channelIdentity, assignmentError )
		// 	} )
		// } )
	}

	setChatAsMissed( chat, error ) {
		this.store.dispatch( setChatMissed( chat.id, error ) )
		// debug( 'setChatAsMissed', chat,	 get( this._chats, chat.id ) );
		// const [ status ] = get( this._chats, chat.id, [] );
		// this._chats = set( this._chats, chat.id, [ STATUS_MISSED, chat ] )
		// if ( status !== STATUS_MISSED ) {
		// 	this.emit( 'miss', error, chat )
		// }
	}

	findAllOpenChats() {
		return Promise.resolve( getChats( this.store.getState() ) )
	}

	findChatById( id ) {
		return Promise.resolve( getChat( id, this.store.getState() ) )
	}

	findChatOperator( chat_id ) {
		return Promise.resolve( getChatOperator( chat_id, this.store.getState() ) )
	}

	findChat( channelIdentity ) {
		return this.findChatById( channelIdentity.id )
	}

	findOperatorChats( operator ) {
		debug( 'search for chats matching operator', this._chats )
		return Promise.resolve(
			map(
				filter( values( this._chats ), ( [ , , op ] ) => op && op.id === operator.id ),
				( [, chat] ) => chat
			)
		)
	}

	insertPendingChat( channelIdentity ) {
		this.store.dispatch( insertPendingChat( channelIdentity ) )
		return channelIdentity
	}

	getChatStatus( chat ) {
		return getChatStatus( chat.id, this.store.getState() )
	}

	setChatStatus( chat, status ) {
		this.store.dispatch( setChatStatus( chat, status ) )
		// const [ , ...chatData ] = get( this._chats, chat.id, [] )
		// this._chats = set( this._chats, chat.id, [ status, ...chatData ] )
		// debug( 'updated ._chats', this._chats )
		// this.emit( 'chat.status', status, chat )
	}

}
