import delayedDispatch from 'redux-delayed-dispatch';
import { keys } from 'ramda'
import { applyMiddleware } from 'redux'

import operatorMiddleware from './middlewares/socket-io/operator'
import chatlistMiddleware from './middlewares/socket-io/chatlist'
import agentMiddleware from './middlewares/socket-io/agents'
import controllerMiddleware from './middlewares/system/controller'
import systemMiddleware from './middlewares/system'
import { DESERIALIZE, SERIALIZE } from './action-types'

const getTime = () => ( new Date() ).getTime()

const log = require( 'debug' )( 'happychat:store' )
const debug = require( 'debug' )( 'happychat-debug:store' )

const logger = () => next => action => {
	debug( 'ACTION_START', action.type, ... keys( action ) )
	const startTime = getTime()
	try {
		const result = next( action )
		const endTime = getTime()
		const ellapsed = endTime - startTime
		if ( ellapsed > 100 ) {
			log( 'slow ACTION', action.type )
		}
		debug( 'ACTION_END', action.type )
		return result
	} catch ( e ) {
		log( 'ACTION_ERROR', action.type, e.message )
		debug( 'ACTION', action )
		throw ( e )
	}
}
export const serializeAction = () => ( { type: SERIALIZE } )
export const deserializeAction = () => ( { type: DESERIALIZE } )

export default ( { io, customerAuth, operatorAuth, agentAuth, messageMiddlewares = [], timeout = undefined }, middlewares = [] ) => {
	debug( 'with 3rd party middleware %d', middlewares.length )
	return applyMiddleware(
		logger,
		... middlewares,
		delayedDispatch,
		controllerMiddleware( messageMiddlewares, { customers: io.of( '/customer' ), operators: io.of( '/operator' ) } ),
		operatorMiddleware( io.of( '/operator' ), operatorAuth, messageMiddlewares ),
		agentMiddleware( io.of( '/agent' ), agentAuth ),
		chatlistMiddleware( {
			io,
			timeout,
			customerDisconnectTimeout: timeout,
			customerDisconnectMessageTimeout: timeout
		}, customerAuth, messageMiddlewares ),
		...systemMiddleware,
	)
}
