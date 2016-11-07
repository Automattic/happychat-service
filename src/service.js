import IO from 'socket.io'
import createStore from './store'
import middlewareInterface from './middleware-interface'

const debug = require( 'debug' )( 'happychat:main' )

export default ( server, { customerAuthenticator, agentAuthenticator, operatorAuthenticator } ) => {
	debug( 'configuring socket.io server' )

	const io = new IO( server )

	const middlewares = middlewareInterface()

	const auth = authenticator => socket => new Promise( ( resolve, reject ) => {
		authenticator( socket, ( e, result ) => {
			if ( e ) {
				socket.emit( 'unauthorized' )
				socket.close()
				return reject( e )
			}
			resolve( result )
		} )
	} )

	const store = createStore( {
		io,
		operatorAuth: auth( operatorAuthenticator ),
		customerAuth: auth( customerAuthenticator ),
		agentAuth: auth( agentAuthenticator ),
		messageMiddlewares: middlewares.middlewares()
	} );

	return { io, controller: middlewares.external, store }
}
