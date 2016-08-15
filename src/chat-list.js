import { EventEmitter } from 'events'
import assign from 'lodash/assign'
import omit from 'lodash/omit'
import forIn from 'lodash/forIn'
import get from 'lodash/get'
import set from 'lodash/set'
import values from 'lodash/values'
import find from 'lodash/find'
import filter from 'lodash/filter'
import reduce from 'lodash/reduce'
import map from 'lodash/map'
import { makeEventMessage } from './util'

const STATUS_PENDING = 'pending'
const STATUS_MISSED = 'missed'
const STATUS_ASSIGNED = 'assigned'
const STATUS_ABANDONED = 'abandoned'

const debug = require( 'debug' )( 'happychat:chat-list' )

const promiseTimeout = ( promise, ms = 1000 ) => new Promise( ( resolve, reject ) => {
	const id = setTimeout( () => reject( new Error( 'timeout' ) ), ms );
	const clear = () => clearTimeout( id )
	promise.then( ( value ) => {
		clear()
		resolve( value )
	}, ( error ) => {
		clearTimeout( id )
		reject( error );
	} )
} )

const asCallback = ( resolve, reject ) => ( e, value ) => {
	if ( e ) return reject( e );
	resolve( value );
}

export class ChatList extends EventEmitter {

	constructor( { customers, operators, timeout = 1000 } ) {
		super()

		// A single store of chats including:
		// 1) a chat's status (pending, assigned, abandoned, missed)
		// 2) the chat identity (user/chat_id)
		// 3) the assigned operator identity
		this._chats = {}

		// Default timeout for querying operator clients for information
		this._timeout = timeout

		// event and io for customer and operator connections
		this.customers = customers
		this.operators = operators

		customers.on( 'message', ( ... args ) => {
			this.onCustomerMessage( ... args )
		} )
		operators.on( 'init', ( operator ) => {
			this.onOperatorConnected( operator )
		} )

		operators.on( 'available', () => {
			this.attemptAssignMissed()
		} )

		// All clients of a single operator are offline
		// mark their chats as abandoned
		operators.on( 'disconnect', ( operator ) => {
			this.findOperatorChats( operator )
			.then( ( chats ) => {
				this._chats = assign( {}, this._chats, reduce( chats, ( abandoned, chat ) => {
					return set( abandoned, chat.id, [ STATUS_ABANDONED, chat, operator ] )
				}, {} ) )
			} )
		} )

		operators.on( 'chat.join', ( chat_id, operator ) => {
			debug( 'find chat', chat_id )
			this.findChatById( chat_id )
			.then( ( chat ) => {
				const room_name = `customers/${ chat.id }`
				operators.emit( 'open', chat, room_name, operator )
				operators.emit( 'message', chat, operator, assign( makeEventMessage( 'operator joined', chat.id ), {
					meta: { operator }
				} ) )
			} )
			.catch( () => {
				debug( 'failed to find chat', chat_id )
			} )
		} )

		operators.on( 'chat.transfer', ( chat_id, from, to ) => {
			debug( 'transfer chat', chat_id )
			this.findChatById( chat_id )
			.then( ( chat ) => {
				return this.findChatOperator( chat_id )
				.then( ( op ) => {
					if ( op.id !== from.id ) {
						throw new Error( 'Assigning operator does not match assigned operator' )
					}
					return promiseTimeout( new Promise( ( resolve, reject ) => {
						operators.emit( 'transfer', chat, to, asCallback( resolve, reject ) )
						operators.emit( 'message', chat, from, assign( makeEventMessage( 'chat transferred', chat.id ), {
							meta: { from, to }
						} ) )
					} ), this._timeout )
				} )
				.then( ( op ) => this.setChatAsAssigned( chat, op ) )
				.then( ( op ) => this.emit( 'transfer', chat, op ) )
				.catch( ( e ) => {
					debug( 'failed to transfer chat', e, chat )
					this.setChatAsMissed( chat, e )
				} )
			} )
			.catch( ( e ) => debug( 'chat does not exist', e ) )
		} )

		operators.on( 'chat.leave', ( chat_id, operator ) => {
			this.findChatById( chat_id )
			.then( ( chat ) => {
				const room_name = `customers/${ chat.id }`
				operators.emit( 'leave', chat, room_name, operator )
				operators.emit( 'message', chat, operator, assign( makeEventMessage( 'operator left', chat.id ), {
					meta: { operator }
				} ) )
			} )
			.catch( ( e ) => debug( 'Chat does not exist', chat_id, e ) )
		} )

		operators.on( 'chat.close', ( chat_id, operator ) => {
			this.findChatById( chat_id )
			.then( ( chat ) => this.closeChat( chat ) )
			.then( ( chat ) => {
				const room_name = `customers/${ chat.id }`
				operators.emit( 'close', chat, room_name, operator )
				operators.emit( 'message', chat, operator, assign( makeEventMessage( 'chat closed', chat.id ), {
					meta: { event_type: 'close', by: operator }
				} ) )
			} )
			.catch( () => {
				throw new Error( 'failed to find chat: ' + chat_id )
			} )
		} )
	}

	onOperatorConnected( { user, socket, room } ) {
		const { id } = user

		// if this is an additional there will be already assigned chats
		// find them and open them on this socket
		this.findOperatorChats( user )
		.then( ( chats ) => {
			debug( 'found existing chats, reassign:', user, chats )
			this.operators.emit( 'reassign', user, socket, chats )
		} )

		// find all chats abandoned by operator and re-assign them
		this.findAbandonedChats( id )
		.then( ( chats ) => {
			debug( 'attempt to recover chats', chats, id )
			this.operators.emit( 'recover', { user, socket, room }, chats, () => {
				this._chats = assign( {}, this._chats, reduce( chats, ( recovered, chat ) => {
					return set( recovered, chat.id, [ STATUS_ASSIGNED, chat, user ] )
				}, {} ) )
			} )
		} )
		.catch( ( e ) => {
			debug( 'failed to search chats', e )
		} )

		// get a list of all open chats and send to operator
		this.findAllOpenChats()
		.then( ( chats ) => {
			socket.emit( 'chats', chats )
		} )
	}

	queryClientAssignment( channelIdentity, room_name ) {
		return promiseTimeout( new Promise( ( resolve, reject ) => {
			this.operators.emit( 'assign', channelIdentity, room_name, asCallback( resolve, reject ) )
		} ), this._timeout )
	}

	setChatAsAssigned( chat, operator ) {
		this._chats = set( this._chats, chat.id, [ STATUS_ASSIGNED, chat, operator ] )
		return Promise.resolve( operator )
	}

	onCustomerMessage( channelIdentity ) {
		// TODO: make a queue and only assign one at a time?
		const { id } = channelIdentity
		const room_name = `customers/${ id }`
		this.findChat( channelIdentity )
		.then( ( chat ) => new Promise( ( resolve, reject ) => {
			// are there any operators in the room?
			this.operators.io.in( room_name ).clients( ( e, clients ) => {
				if ( e ) {
					debug( 'failed to query clients', e )
					return reject( e )
				}
				if ( clients.length === 0 ) {
					debug( 'no operators', chat )
					return reject( new Error( 'channel has no operator' ) )
				}
				resolve( chat )
			} )
		} ) )
		.then( ( chat ) => {
			debug( 'chat already managed', chat.id )
		} )
		.catch( ( e ) => {
			debug( 'chat has not been assigned, finding an operator', e, channelIdentity, room_name )
			this._chats = set( this._chats, channelIdentity.id, [ STATUS_PENDING, channelIdentity ] )
			let chat = this.insertPendingChat( channelIdentity )
			this.emit( 'chat.status', 'pending', chat )

			this.queryClientAssignment( chat, room_name )
			.then( operator => this.setChatAsAssigned( chat, operator ) )
			.then( operator => {
				this.emit( 'chat.status', 'found', chat, operator )
				this.emit( 'found', chat, operator )
				// TODO: Send a message to the chat that an operator was found/opened
				this.operators.emit( 'message', chat, operator, assign( makeEventMessage( 'operator assigned' ), {
					meta: { operator, event_type: 'assigned' }
				} ) )
			} )
			.catch( ( assignmentError ) => {
				debug( 'failed to find operator', assignmentError )
				this.setChatAsMissed( channelIdentity, assignmentError )
			} )
		} )
	}

	setChatAsMissed( chat, error ) {
		this._chats = set( this._chats, chat.id, [ STATUS_MISSED, chat ] )
		this.emit( 'miss', error, chat )
	}

	findChatById( id ) {
		return this.findAllOpenChats()
		.then( ( chats ) => new Promise( ( resolve, reject ) => {
			const chat = find( chats, ( { id: chat_id } ) => chat_id === id )
			if ( chat ) {
				return resolve( chat )
			}
			reject()
		} ) )
	}

	findChatOperator( chat_id ) {
		return new Promise( ( resolve ) => {
			resolve( get( this._chats, chat_id, [] )[2] )
		} )
	}

	findChat( channelIdentity ) {
		debug( 'searching for chat', channelIdentity )
		return this.findChatById( channelIdentity.id )
	}

	findAbandonedChats( operator_id ) {
		return new Promise( ( resolve ) => {
			var chats = []
			forIn( this._chats, ( [ status, chat, operator ] ) => {
				if ( ( operator && operator.id === operator_id ) && status === STATUS_ABANDONED ) {
					chats.push( chat )
				}
			} )
			resolve( chats )
		} )
	}

	findAllOpenChats() {
		const records = values( this._chats )
		return Promise.resolve( map( records, ( [, chat] ) => chat ) )
	}

	findOperatorChats( operator ) {
		return new Promise( ( resolve ) => {
			resolve( map( filter( values( this._chats ), ( [ , , op ] ) => op.id === operator.id ), ( [, chat] ) => chat ) )
		} )
	}

	insertPendingChat( channelIdentity ) {
		this._chats = set( this._chats, channelIdentity.id, [ STATUS_PENDING, channelIdentity ] )
		return channelIdentity
	}

	attemptAssignMissed() {
		const [ next ] = reduce( this._chats, ( chats, [ status, chat ] ) => {
			if ( status === STATUS_MISSED ) {
				return chats.concat( chat )
			}
			return chats
		}, [] )
		if ( !next ) {
			debug( 'no missed chats' )
			return
		}
		debug( 'attempting to assign missed chat:', next )
		this.onCustomerMessage( next )
	}

	closeChat( chat ) {
		return new Promise( ( resolve ) => {
			set( this, '_chats', omit( get( this, '_chats', {} ), chat.id ) )
			resolve( chat )
		} )
	}

}
