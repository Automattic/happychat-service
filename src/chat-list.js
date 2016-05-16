import { EventEmitter } from 'events'
import { assign, omit, forIn, get, set, values } from 'lodash/object'
import { find, filter, reduce, map } from 'lodash/collection'

const STATUS_PENDING = 'pending'
const STATUS_MISSED = 'missed'
const STATUS_ASSIGNED = 'assigned'
const STATUS_ABANDONED = 'abandoned'

const debug = require( 'debug' )( 'tinkerchat:chat-list' )

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
		operators.on( 'leave', ( operator ) => {
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
			} )
			.catch( () => {
				debug( 'failed to find chat', chat_id )
			} )
		} )

		operators.on( 'chat.leave', ( chat_id, operator ) => {
			this.findChatById( chat_id )
			.then( ( chat ) => {
				const room_name = `customers/${ chat.id }`
				operators.emit( 'leave', chat, room_name, operator )
			} )
			.catch( ( e ) => debug( 'Chat does not exist', chat_id, e ) )
		} )

		operators.on( 'chat.close', ( chat_id, operator ) => {
			this.findChatById( chat_id )
			.then( ( chat ) => this.closeChat( chat ) )
			.then( ( chat ) => {
				const room_name = `customers/${ chat.id }`
				operators.emit( 'close', chat, room_name, operator )
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
		return new Promise( ( resolve, reject ) => {
			const timeout = setTimeout( () => reject( new Error( 'timeout: failed to find operator' ) ), this._timeout )
			this.operators.emit( 'assign', channelIdentity, room_name, ( error, operatorId ) => {
				clearTimeout( timeout )
				if ( error ) {
					return reject( error )
				}
				return resolve( operatorId )
			} )
		} )
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
			debug( 'chat has not been assigned, finding an operator', e, channelIdentity )
			this._chats = set( this._chats, channelIdentity.id, [ STATUS_PENDING, channelIdentity ] )
			this.emit( 'chat.status', 'pending', channelIdentity )

			this.queryClientAssignment( channelIdentity, room_name )
			.then( ( operator ) => {
				this._chats = set( this._chats, channelIdentity.id, [ STATUS_ASSIGNED, channelIdentity, operator ] )
				this.emit( 'chat.status', 'found', channelIdentity, operator )
				this.emit( 'found', channelIdentity, operator )
				// TODO see if there are any operators in this users's channel,
				// if not we need to assign a new operator
			} )
			.catch( ( assignmentError ) => {
				debug( 'failed to find operator' )
				this._chats = set( this._chats, channelIdentity.id, [ STATUS_MISSED, channelIdentity ] )
				this.emit( 'miss', assignmentError, channelIdentity )
			} )
		} )
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

	findChat( channelIdentity ) {
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
