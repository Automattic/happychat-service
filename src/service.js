import {
	compose as r_compose,
	isNil,
	prop,
	anyPass,
	when,
	map,
	join,
	keys,
	difference,
	append,
	once,
} from 'ramda'

import { createStore, compose } from 'redux'

import enhancer from './state'
import reducer from './state/reducer'
import { removeChat } from './state/chatlist/actions'
import { getClosedChatsOlderThan } from './state/chatlist/selectors'
import middlewareInterface from './middleware-interface'
import { configureLocales } from './state/locales/actions'
import upgradeCapacities from './upgrade-capacities'
import broadcast from './broadcast'

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

export const service = ( io, { customerAuthenticator, agentAuthenticator, operatorAuthenticator }, initialState, { enhancers = [], middlewares = []} ) => {
	log( 'configuring socket.io server' )

	const messageMiddlewares = middlewareInterface()

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

	const store = createStore( reducer, initialState, compose( ... enhancers, enhancer( {
		io,
		operatorAuth: auth( operatorAuthenticator, validateKeys( REQUIRED_OPERATOR_KEYS ) ),
		customerAuth: auth( customerAuthenticator, validateKeys( REQUIRED_CUSTOMER_KEYS ) ),
		agentAuth: auth( agentAuthenticator ),
		messageMiddlewares: messageMiddlewares.middlewares()
	}, middlewares ) ) )

	broadcast( store, io.of( '/operator' ) )

	const removeStaleChats = buildRemoveStaleChats( store )
	setInterval( removeStaleChats, 1000 * 60 ) // every minute
	process.nextTick( removeStaleChats )

	const upgradeCapacitiesOnce = once( upgradeCapacities( store ) )

	return {
		io,
		controller: messageMiddlewares.external,
		store,
		configureLocales: ( defaultLocale, supportedLocales ) => {
			store.dispatch( configureLocales( defaultLocale, supportedLocales ) )
			// go through each identity and remove the capacities and loads
			// set use the capacity to set the users capacity for the default locale
			upgradeCapacitiesOnce()
		}
	}
}
