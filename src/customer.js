import { EventEmitter } from 'events'
import { onConnection } from './util'

const debug = require( 'debug' )( 'tinkerchat:customer' )

const identityForUser = ( { id, displayName, avatarURL } ) => (
	{ id, displayName, avatarURL }
)

const timestamp = () => (
	Math.ceil( ( new Date() ).getTime() / 1000 )
)

/**
  - `user`: (**required**) a JSON key/value object containing:
    - `id`: (**required**) the unique identifier for this user in the *Support Provider*'s system
    - `username`: (**required**) an account name for the user
    - `displayName`: (**required**) name to use in application UI
    - `avatarURL`: (**required**) URL to image to display as user's avatar
    - `tags`: Array of strings to identify the user (example: `['premium', 'expired']`)
 */

const init = ( { user, socket, events, io } ) => () => {
	const socketIdentifier = { id: user.id, socket_id: socket.id }
	debug( 'user joined room', user.id )

	socket.on( 'message', ( { text, id } ) => {
		const meta = {}
		const userIdentity = identityForUser( user )
		const message = { id: id, text, timestamp: timestamp(), user: userIdentity, meta }
		// all customer connections for this user receive the message
		debug( 'broadcasting message', user.id, id, text )
		io.to( user.id ).emit( 'message', message )
		events.emit( 'message', user, message )
	} )

	socket.on( 'disconnect', () => events.emit( 'leave', socketIdentifier ) )
	events.emit( 'join', socketIdentifier, user )
	socket.emit( 'init', user )
}

const join = ( { events, io, user, socket } ) => {
	debug( 'user joined', user.username, user.id )

	// user joins room based on their identifier
	socket.join( user.id, init( { user, socket, events, io } ) )
}

export default ( io ) => {
	const events = new EventEmitter()

	events.on( 'receive', ( message ) => {
		let { context } = message
		io.to( context ).emit( 'message', message )
	} )
	io.on( 'connection', ( socket ) => {
		debug( 'customer connecting' )
		onConnection( { socket, events } )( ( user ) => join( { socket, events, user, io } ) )
	} )
	return events
}
