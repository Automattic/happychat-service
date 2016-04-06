import { EventEmitter } from 'events'
import { omit } from 'lodash/object'

const debug = require( 'debug' )( 'tinkerchat:chat-list' )

export class ChatList extends EventEmitter {

	constructor( { customers, operators, timeout = 1000 } ) {
		super()
		this._chats = {}
		this._pending = {}

		this._timeout = timeout
		this.customers = customers
		this.operators = operators

		customers.on( 'message', ( ... args ) => {
			this.onCustomerMessage( ... args )
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
						return reject( error )
					}
					return resolve( operatorId )
				} )
			} )

			opened
			.then( ( operator ) => {
				// TODO: should operator be a socket?
				this._chats[ id ] = operator
				this._pending = omit( this._pending, id )
				this.emit( 'found', channelIdentity, operator )
			} )
			.catch( ( e ) => {
				debug( 'failed to find operator', e )
				this.emit( 'miss', e, channelIdentity )
			} )
		} )

		.catch( ( e ) => debug( 'Failed to find chat', e ) )
	}

	findChat( channelIdentity ) {
		const { id } = channelIdentity
		return new Promise( ( resolve ) => {
			if ( this._pending[id] ) {
				return resolve( this.pending[id] )
			}

			if ( this._chats[id] ) {
				return resolve( this._chats[id] )
			}

			resolve()
		} )
	}
}
