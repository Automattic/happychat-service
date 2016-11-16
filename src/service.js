import IO from 'socket.io'
import { combineReducers } from 'redux'
import createStore from './store'
import middlewareInterface from './middleware-interface'
import operatorReducer from './operator/reducer'
import chatlistReducer from './chat-list/reducer'

const debug = require( 'debug' )( 'happychat:main' )

export const reducer = combineReducers( { operators: operatorReducer, chatlist: chatlistReducer } )

export const service = ( server, { customerAuthenticator, agentAuthenticator, operatorAuthenticator, state } ) => {
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
