import { EventEmitter } from 'events'
import { omit, omitBy, forIn } from 'lodash/object'
import { find, every } from 'lodash/collection'
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

	onOperatorConnected( { id, socket } ) {
		// find all chats abandoned by operator and re-assign them
		this.findAbandonedChats( id )
		.then( ( chats ) => {
			socket.emit( 'chats', chats, () => {
				this._abandoned = omitBy( this._abandoned, ( { operator, channel } ) => {
					return find( chats, ( { id: channel_id } ) => channel_id === channel.id )
				} )
				every( chats, ( { id: chat_id } ) => this._chats[chat_id] = id )
			} )
		} )
		.catch( ( e ) => {
			debug( 'failed to search chats', e )
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
			const opened = new Promise( ( resolve, reject ) => {
				const timeout = setTimeout( () => reject( new Error( 'timeout: failed to find operator' ) ), this._timeout )
				this.operators.emit( 'assign', channelIdentity, ( error, operatorId ) => {
					clearTimeout( timeout )
					if ( error ) {
						this._pending[ id ] = undefined
						return reject( error )
					}
					return resolve( operatorId )
				} )
			} )

			opened
			.then( ( operator ) => {
				debug( 'found operator', operator )
				this._chats[ id ] = operator
				this._pending = omit( this._pending, id )
				this.emit( 'found', channelIdentity, operator )
				operator.socket.once( 'disconnect', () => {
					const room_name = `customers/${ id }`
					this.operators.io.in( room_name ).clients( ( error, clients ) => {
						if ( error ) {
							return debug( 'Failed to query rooms', room_name )
						}
						if ( isEmpty( clients ) ) {
							// TODO: attempt to find another operator?
							debug( 'Chat is no longer managed', id )
							this._chats = omit( this._chats, id )
							this._abandoned[id] = { operator: operator.id, channel: channelIdentity }
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
}
