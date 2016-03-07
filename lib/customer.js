import { v4 as uuid } from 'uuid'

const debug = require( 'debug' )( 'tinkerchat:customer' )

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

/**
  - `user`: (**required**) a JSON key/value object containing:
    - `id`: (**required**) the unique identifier for this user in the *Support Provider*'s system
    - `username`: (**required**) an account name for the user
    - `displayName`: (**required**) name to use in application UI
    - `avatarURL`: (**required**) URL to image to display as user's avatar
    - `tags`: Array of strings to identify the user (example: `['premium', 'expired']`)
 */
const join = ( { user, socket } ) => {
	debug( 'user joined', user.username, user.id )
	const userIdentity = identityForUser( user )
	socket.on( 'message', ( text ) => {
		// TODO: transform the message to a user identity and emit to socket and
		// external module emitter
		const meta = {}
		socket.emit( 'message', { id: uuid(), text, timestamp: timestamp(), user: userIdentity, meta } )
	} )

	socket.emit( 'init', user )
}

const onToken = ( { authenticator, socket } ) => ( token ) => {
	debug( 'authenticating user' )
	authenticate( authenticator, token )
	.then( ( user ) => join( { user, socket } ) )
	.catch( () => socket.emit( 'unauthorized' ) )
}

const onConnection = ( { authenticator } ) => ( socket ) => {
	socket.on( 'token', onToken( { authenticator, socket } ) )
	// ask connection for token
	socket.emit( 'token' )
}

export default ( io, authenticator ) => io.on( 'connection', onConnection( { authenticator } ) )
