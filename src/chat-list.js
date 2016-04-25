import { EventEmitter } from 'events'
import { omit, omitBy, forIn } from 'lodash/object'
import { find, every, reduce } from 'lodash/collection'
import { isEmpty } from 'lodash/lang'

const debug = require( 'debug' )( 'tinkerchat:chat-list' )

export class ChatList extends EventEmitter {

	constructor( { customers, operators, timeout = 1000 } ) {
		super()
		this._chats = {}
		this._pending = {}
		this._abandoned = {}

		this._timeout = timeout
		this.customers = customers
		this.operators = operators

		customers.on( 'message', ( ... args ) => {
			this.onCustomerMessage( ... args )
		} )
		operators.on( 'init', ( operator ) => {
			this.onOperatorConnected( operator )
		} )
	}

	onOperatorConnected( { user, socket, room } ) {
		const { id } = user
		// find all chats abandoned by operator and re-assign them
		this.findAbandonedChats( id )
		.then( ( chats ) => {
			this.operators.emit( 'recover', { user, socket, room }, chats, () => {
				this._abandoned = omitBy( this._abandoned, ( { channel } ) => {
					return find( chats, ( { id: channel_id } ) => channel_id === channel.id )
				} )
				every( chats, ( { id: chat_id } ) => this._chats[chat_id] = id )
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
		const { id } = channelIdentity
		this.findChat( channelIdentity )
		.then( ( chat ) => {
			if ( chat ) {
				return debug( 'chat already being managed' )
			}
			this.emit( 'open', channelIdentity )

			this._pending[ id ] = channelIdentity

			this.emit( 'chat.status', 'pending', channelIdentity )

			const room_name = `customers/${ id }`

			this.queryClientAssignment( channelIdentity, room_name )
			.then( ( operator ) => {
				this._chats[ id ] = operator
				this._pending = omit( this._pending, id )
				this.emit( 'chat.status', 'found', channelIdentity, operator )
				this.emit( 'found', channelIdentity, operator )
				operator.socket.once( 'disconnect', () => {
					// Check if there are any connected operators in the current room
					// if there are no more operators in the room, the chat has been abandoned
					// TODO: set a timeout to alert that there's an active chat that needs to be re-assigned
					this.operators.io.in( room_name ).clients( ( error, clients ) => {
						if ( error ) {
							return debug( 'Failed to query rooms', room_name )
						}
						if ( isEmpty( clients ) ) {
							// TODO: attempt to find another operator?
							debug( 'Chat is no longer managed', id )
							this._chats = omit( this._chats, id )
							this._abandoned[id] = { operator: operator.id, channel: channelIdentity }
							this.emit( 'chat.status', 'abandoned', channelIdentity )
						}
					} )
				} )
			} )
			.catch( ( e ) => {
				debug( 'failed to find operator', e )
				this.emit( 'miss', e, channelIdentity )
			} )
		} )

		.catch( ( e ) => debug( 'Failed to find chat', e, e.stack ) )
	}

	findChat( channelIdentity ) {
		const { id } = channelIdentity
		return new Promise( ( resolve ) => {
			if ( this._pending[id] ) {
				return resolve( this._pending[id] )
			}

			if ( this._chats[id] ) {
				return resolve( this._chats[id] )
			}

			resolve()
		} )
	}

	findAbandonedChats( operator_id ) {
		return new Promise( ( resolve ) => {
			var chats = []
			forIn( this._abandoned, ( { operator, channel } ) => {
				if ( operator === operator_id ) {
					chats.push( channel )
				}
			} )
			resolve( chats )
		} )
	}

	findAllOpenChats() {
		return new Promise( ( resolve ) => {
			// _chats are live with operators
			const lists = [ this._chats, this._pending, this._abandoned ]
			const reduceChats = ( list ) => reduce( list, ( all, value ) => all.concat( value ), [] )
			const chats = reduce( lists, ( all, list ) => {
				return all.concat( reduceChats( list ) )
			}, [] )
			resolve( chats )
		} )
	}
}
