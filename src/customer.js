import { EventEmitter } from 'events'
import { onConnection, timestamp } from './util'

const debug = require( 'debug' )( 'happychat:customer' )

// limit the information for the user
const identityForUser = ( { id, name, username, picture } ) => ( { id, name, username, picture } )

const customerRoom = ( { session_id } ) => `session/${ session_id }`
const chatRoom = ( { id } ) => `session/${ id }`

/**
  - `user`: (**required**) a JSON key/value object containing:
    - `id`: (**required**) the unique identifier for this user in the *Support Provider*'s system
    - `username`: (**required**) an account name for the user
    - `name`: (**required**) name to use in application UI
    - `picture`: (**required**) URL to image to display as user's avatar
    - `tags`: Array of strings to identify the user (example: `['premium', 'expired']`)
*/

const init = ( { user, socket, events, io } ) => () => {
	const socketIdentifier = { id: user.id, socket_id: socket.id, session_id: user.session_id }
	const chat = {
		user_id: user.id,
		id: user.session_id,
		username: user.username,
		name: user.name,
		picture: user.picture
	}

	debug( 'chat initialized', chat )

	socket.on( 'message', ( { text, id, meta } ) => {
		const message = { session_id: chat.id, id: id, text, timestamp: timestamp(), user: identityForUser( user ), meta }
		debug( 'received customer message', message )
		// all customer connections for this user receive the message
		// io.to( user.id ).emit( 'message', message )
		events.emit( 'message', chat, message )
	} )

	socket.on( 'typing', ( text ) => {
		events.emit( 'typing', chat, user, text );
	} )

	socket.on( 'disconnect', () => {
		debug( 'socket.on.disconnect', user.id, socketIdentifier );

		events.emit( 'disconnect-socket', { user, chat, socket } )

		io.in( chatRoom( chat ) ).clients( ( error, clients ) => {
			if ( error ) {
				debug( 'failed to query customer clients', chat, error )
				return;
			}

			if ( clients.length > 0 ) {
				return;
			}

			events.emit( 'disconnect', chat, user )
		} )
	} )

	socket.emit( 'init', user )
	events.emit( 'join', socketIdentifier, chat, socket )
}

const join = ( { events, io, user, socket } ) => {
	debug( 'user joined', user )
	socket.join( customerRoom( user ), init( { user, socket, events, io } ) )
}

export default ( io ) => {
	const events = new EventEmitter()
	events.io = io

	events.on( 'receive', ( chat, message ) => {
		debug( 'sending message to customer', chat, message )
		io.to( chatRoom( chat ) ).emit( 'message', message )
	} )

	events.on( 'receive.typing', ( chat, user, text ) => {
		// customers shouldn't know who is typing or what they're typing
		const isTyping = typeof text === 'string' && text.length > 0 ? true : false
		io.to( chatRoom( chat ) ).emit( 'typing', isTyping )
	} )

	io.on( 'connection', ( socket ) => {
		debug( 'customer connecting' )
		onConnection( { socket, events } )( ( user ) => join( { socket, events, user, io } ) )
	} )
	return events
}
