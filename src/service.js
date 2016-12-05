import IO from 'socket.io'
import createStore from './state'
import reducer from './state/reducer'
import middlewareInterface from './middleware-interface'
const debug = require( 'debug' )( 'happychat:main' )

export { reducer }

export const service = ( server, { customerAuthenticator, agentAuthenticator, operatorAuthenticator }, state ) => {
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
	}, state, reducer );

	return { io, controller: middlewares.external, store }
}
