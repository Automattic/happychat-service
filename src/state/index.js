import delayedDispatch from 'redux-delayed-dispatch';
import { keys } from 'ramda'
import { applyMiddleware } from 'redux'

import operatorMiddleware from './middlewares/socket-io'
import chatlistMiddleware from './middlewares/socket-io/chatlist'
import broadcastMiddleware from './middlewares/socket-io/broadcast'
import agentMiddleware from './middlewares/socket-io/agents'
import controllerMiddleware from './middlewares/socket-io/controller'
import operatorLoadMiddleware from './middlewares/socket-io/operator-load'
import canRemoteDispatch from './operator/canRemoteDispatch'
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
		log( 'ACTION', action.type, endTime - startTime, 'ms' )
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

export default ( { io, customerAuth, operatorAuth, agentAuth, messageMiddlewares = [], timeout = undefined } ) => {
	return applyMiddleware(
			logger,
			delayedDispatch,
			controllerMiddleware( messageMiddlewares ),
			operatorMiddleware( io.of( '/operator' ), operatorAuth, messageMiddlewares ),
			agentMiddleware( io.of( '/agent' ), agentAuth ),
			chatlistMiddleware( {
				io,
				timeout,
				customerDisconnectTimeout: timeout,
				customerDisconnectMessageTimeout: timeout
			}, customerAuth, messageMiddlewares ),
			broadcastMiddleware( io.of( '/operator' ), canRemoteDispatch ),
			...operatorLoadMiddleware,
	)
}
