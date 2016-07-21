import { EventEmitter } from 'events'
import { onConnection, timestamp } from './util'

const debug = require( 'debug' )( 'happychat:customer' )

// limit the information for the user
const identityForUser = ( { id, displayName, avatarURL } ) => ( { id, displayName, avatarURL } )

/**
  - `user`: (**required**) a JSON key/value object containing:
    - `id`: (**required**) the unique identifier for this user in the *Support Provider*'s system
    - `username`: (**required**) an account name for the user
    - `displayName`: (**required**) name to use in application UI
    - `avatarURL`: (**required**) URL to image to display as user's avatar
    - `tags`: Array of strings to identify the user (example: `['premium', 'expired']`)
 */

const init = ( { user, socket, events, io } ) => () => {
	const socketIdentifier = { id: user.id, socket_id: socket.id, session_id: user.session_id }
	debug( 'user joined room', user.id )

	socket.on( 'message', ( { text, id, meta } ) => {
		const message = { session_id: user.session_id, id: id, text, timestamp: timestamp(), user: identityForUser( user ), meta }
		debug( 'received customer message', message )
		// all customer connections for this user receive the message
		// io.to( user.id ).emit( 'message', message )
		events.emit( 'message', user, message )
	} )

	socket.on( 'disconnect', () => events.emit( 'leave', socketIdentifier ) )
	socket.emit( 'init', user )
	events.emit( 'join', socketIdentifier, user, socket )
}

const join = ( { events, io, user, socket } ) => {
	debug( 'user joined', user.username, user.id )

	// user joins room based on their identifier
	socket.join( user.id, init( { user, socket, events, io } ) )
}

export default ( io ) => {
	const events = new EventEmitter()
	events.io = io

	events.on( 'receive', ( user, message ) => {
		debug( 'sending message to customer', user, message )
		io.to( user.id ).emit( 'message', message )
	} )
	io.on( 'connection', ( socket ) => {
		debug( 'customer connecting' )
		onConnection( { socket, events } )( ( user ) => join( { socket, events, user, io } ) )
	} )
	return events
}
