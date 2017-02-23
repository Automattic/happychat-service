import IO from 'socket.io'
import { compose as r_compose, isNil, prop, anyPass, when, map, join, keys, difference, append } from 'ramda'
import enhancer from './state'
import reducer from './state/reducer'
import { removeChat } from './state/chatlist/actions'
import { getClosedChatsOlderThan } from './state/chatlist/selectors'
import middlewareInterface from './middleware-interface'
import { createStore, compose } from 'redux'

const log = require( 'debug' )( 'happychat:service' )

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

const FOUR_HOURS_IN_SECONDS = 60 * 60 * 4
const buildRemoveStaleChats = ( { getState, dispatch }, maxAgeIsSeconds = FOUR_HOURS_IN_SECONDS ) => () => {
	map(
		( chat ) => {
			if ( chat && chat.id ) {
				dispatch( removeChat( chat.id ) )
			}
		},
		getClosedChatsOlderThan( maxAgeIsSeconds, getState() )
	)
}

export const service = ( server, { customerAuthenticator, agentAuthenticator, operatorAuthenticator }, state, enhancers = [] ) => {
	log( 'configuring socket.io server' )

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
		log( 'failed to authorize user', e.message )
		socket.emit( 'unauthorized' )
	} )

	const store = createStore( reducer, state, compose( enhancer( {
		io,
		operatorAuth: auth( operatorAuthenticator, validateKeys( REQUIRED_OPERATOR_KEYS ) ),
		customerAuth: auth( customerAuthenticator, validateKeys( REQUIRED_CUSTOMER_KEYS ) ),
		agentAuth: auth( agentAuthenticator ),
		messageMiddlewares: middlewares.middlewares()
	} ), ... enhancers ) )

	const removeStaleChats = buildRemoveStaleChats( store )
	setInterval( removeStaleChats, 1000 * 60 ) // every minute
	process.nextTick( removeStaleChats )
	return { io, controller: middlewares.external, store }
}
