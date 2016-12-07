import IO from 'socket.io'
import enhancer from './state'
import reducer from './state/reducer'
import middlewareInterface from './middleware-interface'
import { createStore } from 'redux'
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

	const store = createStore( reducer, state, enhancer( {
		io,
		operatorAuth: auth( operatorAuthenticator ),
		customerAuth: auth( customerAuthenticator ),
		agentAuth: auth( agentAuthenticator ),
		messageMiddlewares: middlewares.middlewares()
	} ) )

	return { io, controller: middlewares.external, store }
}
