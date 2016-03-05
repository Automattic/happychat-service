const debug = require( 'debug' )( 'tinkerchat:customer' )

const authenticate = ( authenticator, token ) => new Promise( ( resolve, reject ) => {
	authenticator( token, ( e, user ) => {
		if ( e ) return reject( e )
		resolve( user )
	} )
} )

const join = ( { user, socket } ) => {
	debug( 'user joined' )
	socket.on( 'message', ( text ) => {
		socket.emit( 'message', text )
	} )

	socket.emit( 'init', user )
}

export default ( io, authenticator ) => {
	io.on( 'connection', ( socket ) => {
		socket.on( 'token', ( token ) => {
			debug( 'authenticating user' )
			authenticate( authenticator, token )
			.then( ( user ) => join( { user, socket } ) )
			.catch( () => {
				socket.emit( 'unauthorized' )
			} )
		} )
		// ask connection for token
		socket.emit( 'token' )
	} )
}
