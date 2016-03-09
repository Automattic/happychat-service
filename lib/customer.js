import { EventEmitter } from 'events'

const debug = require( 'debug' )( 'tinkerchat:customer' )

// change a lib/customer message to what an agent client expects
const formatAgentMessage = ( author_type, author_id, context, { id, timestamp, text } ) => ( {
	id, timestamp, text,
	context,
	author_id,
	author_type
} )

const identityForUser = ( { id, displayName, avatarURL } ) => (
	{ id, displayName, avatarURL }
)

const timestamp = () => (
	Math.ceil( ( new Date() ).getTime() / 1000 )
)

const authenticate = ( authenticator, token ) => new Promise( ( resolve, reject ) => {
	authenticator( token, ( e, user ) => {
		if ( e ) return reject( e )
		resolve( user )
	} )
} )

const init = ( { user, socket, events, io } ) => () => {
	debug( 'user joined room', user.id )
	socket.on( 'message', ( { text, id } ) => {
		const meta = {}
		const userIdentity = identityForUser( user )
		const message = { id: id, text, timestamp: timestamp(), user: userIdentity, meta }
		// all customer connections for this user receive the message
		debug( 'broadcasting message', user.id, id, text )
		io.to( user.id ).emit( 'message', message )
		events.emit( 'receive', formatAgentMessage( 'customer', user.id, user.id, message ) )
	} )

	events.emit( 'join', { id: user.id, socket_id: socket.id } )
	socket.emit( 'init', user )
}

/**
  - `user`: (**required**) a JSON key/value object containing:
    - `id`: (**required**) the unique identifier for this user in the *Support Provider*'s system
    - `username`: (**required**) an account name for the user
    - `displayName`: (**required**) name to use in application UI
    - `avatarURL`: (**required**) URL to image to display as user's avatar
    - `tags`: Array of strings to identify the user (example: `['premium', 'expired']`)
 */
const join = ( { user, socket, events, io } ) => {
	debug( 'user joined', user.username, user.id )

	// user joins room based on their identifier
	socket.join( user.id, init( { user, socket, events, io } ) )
}

const onToken = ( { authenticator, socket, events, io } ) => ( token ) => {
	debug( 'authenticating user' )
	authenticate( authenticator, token )
	.then( ( user ) => join( { user, socket, events, io } ) )
	.catch( ( e ) => {
		debug( 'unauthorized customer', e )
		socket.emit( 'unauthorized' )
		socket.close()
	} )
}

const onConnection = ( { authenticator, events, io } ) => ( socket ) => {
	socket.on( 'token', onToken( { authenticator, socket, events, io } ) )
	// ask connection for token
	socket.emit( 'token' )
}

export default ( io, authenticator ) => {
	const events = new EventEmitter()
	events.on( 'send', ( message ) => {
		let { context, user } = message
		io.to( context ).emit( 'message', message )
		debug( 'send from', user )
		events.emit( 'receive', formatAgentMessage( 'agent', user.id, context, message ) )
	} )
	io.on( 'connection', onConnection( { authenticator, events, io } ) )
	return events
}
