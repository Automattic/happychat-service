import delayedDispatch from 'redux-delayed-dispatch';
import { keys } from 'ramda'
import { applyMiddleware } from 'redux'

import operatorMiddleware from './middlewares/socket-io'
import chatlistMiddleware from './middlewares/socket-io/chatlist'
import broadcastMiddleware from './middlewares/socket-io/broadcast'
import agentMiddleware from './middlewares/socket-io/agents'
import controllerMiddleware from './middlewares/socket-io/controller'
import systemMiddleware from './middlewares/system'
import canRemoteDispatch from './operator/can-remote-dispatch'
import { DESERIALIZE, SERIALIZE } from './action-types'

const debug = require( 'debug' )( 'happychat:store' )
const logger = () => next => action => {
	debug( 'ACTION_START', action.type, ... keys( action ) )
	try {
		const result = next( action )
		debug( 'ACTION_END', action.type )
		return result
	} catch ( e ) {
		debug( 'ACTION_ERROR', action.type, e.message )
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
			...systemMiddleware,
	)
}
