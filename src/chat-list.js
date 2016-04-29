import { EventEmitter } from 'events'
import { omit, omitBy, forIn, mapValues, get, set } from 'lodash/object'
import { find, every, reduce, forEach } from 'lodash/collection'

const debug = require( 'debug' )( 'tinkerchat:chat-list' )

export class ChatList extends EventEmitter {

	constructor( { customers, operators, timeout = 1000 } ) {
		super()

		// chat state management
		this._chats = {}
		this._pending = {}
		this._abandoned = {}
		this._operators = {}

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
				forEach( chats, ( id ) => {
					const chat = this._chats[id]
					this._chats = omitBy( this._chats, ( { id: chat_id } ) => chat_id === id )
					this._abandoned[id] = { channel: chat, operator }
					this.emit( 'chat.status', 'abandoned', chat )
				} )
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
			this.operators.emit( 'reassign', chats )
		} )

		// find all chats abandoned by operator and re-assign them
		this.findAbandonedChats( id )
		.then( ( chats ) => {
			debug( 'attempt to recover chats', chats, id )
			this.operators.emit( 'recover', { user, socket, room }, chats, () => {
				this._abandoned = omitBy( this._abandoned, ( { channel } ) => {
					return find( chats, ( { id: channel_id } ) => channel_id === channel.id )
				} )
				every( chats, ( chat ) => this._chats[chat.id] = chat )
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
		const { id } = channelIdentity
		return new Promise( ( resolve, reject ) => {
			const timeout = setTimeout( () => reject( new Error( 'timeout: failed to find operator' ) ), this._timeout )
			this.operators.emit( 'assign', channelIdentity, room_name, ( error, operatorId ) => {
				clearTimeout( timeout )
				if ( error ) {
					this._pending[ id ] = undefined
					return reject( error )
				}
				return resolve( operatorId )
			} )
		} )
	}

	onCustomerMessage( channelIdentity, message ) {
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
			debug( 'chat has not be assigned, finding an operator', e, channelIdentity )
			this._pending[ id ] = channelIdentity
			this.emit( 'chat.status', 'pending', channelIdentity )

			this.queryClientAssignment( channelIdentity, room_name )
			.then( ( operator ) => {
				if ( ! this._operators[ operator.id ] ) {
					this._operators[operator.id] = []
				}
				this._operators[ operator.id ].push( id )
				this._chats[ id ] = channelIdentity
				this._pending = omit( this._pending, id )
				this.emit( 'chat.status', 'found', channelIdentity, operator )
				this.emit( 'found', channelIdentity, operator )
				// TODO see if there are any operators in this users's channel,
				// if not we need to assign a new operator
			} )
			.catch( ( e ) => {
				set( this, '_missed', get( this, '_missed', [] ).concat( channelIdentity ) );
				debug( 'failed to find operator', e, this._missed.length )
				this.emit( 'miss', e, channelIdentity )
			} )
		} )
	}

	findChat( channelIdentity ) {
		const { id } = channelIdentity
		return new Promise( ( resolve, reject ) => {
			if ( this._pending[id] ) {
				return resolve( this._pending[id] )
			}

			if ( this._chats[id] ) {
				return resolve( this._chats[id] )
			}

			reject()
		} )
	}

	findAbandonedChats( operator_id ) {
		return new Promise( ( resolve ) => {
			var chats = []
			forIn( this._abandoned, ( { operator, channel } ) => {
				if ( operator.id === operator_id ) {
					chats.push( channel )
				}
			} )
			resolve( chats )
		} )
	}

	findAllOpenChats() {
		return new Promise( ( resolve ) => {
			// _chats are live with operators
			const lists = [ this._chats, this._pending, mapValues( this._abandoned, ( { channel } ) => channel ) ]
			const reduceChats = ( list ) => reduce( list, ( all, value ) => all.concat( value ), [] )
			const chats = reduce( lists, ( all, list ) => {
				return all.concat( reduceChats( list ) )
			}, [] )
			resolve( chats )
		} )
	}

	findOperatorChats( operator ) {
		return new Promise( ( resolve ) => {
			resolve( get( this._operators, operator.id, [] ) )
		} )
	}

	attemptAssignMissed() {
		return new Promise( ( resolve, reject ) => {
			const [next, ... rest] = get( this, '_missed', [] )
			if ( !next ) {
				return
			}
			set( this, '_missed', rest )
			debug( 'attempting to assign missed chat:', next )
			this.onCustomerMessage( next )
		} )
	}

}
