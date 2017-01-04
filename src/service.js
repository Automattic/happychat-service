import IO from 'socket.io'
import { compose as r_compose, isNil, prop, anyPass, when, map, join, keys, difference, append } from 'ramda'
import enhancer from './state'
import reducer from './state/reducer'
import middlewareInterface from './middleware-interface'
import { createStore, compose } from 'redux'
const debug = require( 'debug' )( 'happychat:main' )

export { reducer }

const keyMissing = key => r_compose( isNil, prop( key ) )

const REQUIRED_OPERATOR_KEYS = [ 'id', 'username', 'displayName', 'picture' ]
const REQUIRED_CUSTOMER_KEYS = append( 'session_id', REQUIRED_OPERATOR_KEYS )
const validateKeys = fields => when(
	anyPass( map( keyMissing, fields ) ),
	user => {
		throw new Error(
			`user invalid, keys missing: ${ compose(
				join( ', ' ),
				difference( fields ),
				keys
			)( user ) }`
		);
	}
)

export const service = ( server, { customerAuthenticator, agentAuthenticator, operatorAuthenticator }, state, enhancers = [] ) => {
	debug( 'configuring socket.io server' )

	const io = new IO( server )

	const middlewares = middlewareInterface()

	const auth = ( authenticator, validator = user => user ) => socket => new Promise( ( resolve, reject ) => {
		authenticator( socket, ( e, result ) => {
			if ( e ) {
				return reject( e )
			}
			resolve( result )
		} )
	} )
	.then( validator )
	.catch( e => {
		debug( 'failed to authorize user', e.message )
		socket.emit( 'unauthorized' )
	} )

	const store = createStore( reducer, state, compose( enhancer( {
		io,
		operatorAuth: auth( operatorAuthenticator, validateKeys( REQUIRED_OPERATOR_KEYS ) ),
		customerAuth: auth( customerAuthenticator, validateKeys( REQUIRED_CUSTOMER_KEYS ) ),
		agentAuth: auth( agentAuthenticator ),
		messageMiddlewares: middlewares.middlewares()
	} ), ... enhancers ) )

	return { io, controller: middlewares.external, store }
}
