import delayedDispatch from 'redux-delayed-dispatch';

import { applyMiddleware, compose } from 'redux'
import operatorMiddleware from './middlewares/socket-io'
import chatlistMiddleware from './middlewares/socket-io/chatlist'
import broadcastMiddleware from './middlewares/socket-io/broadcast'
import agentMiddleware from './middlewares/socket-io/agents'
import controllerMiddleware from './middlewares/socket-io/controller'
import operatorLoadMiddleware from './middlewares/socket-io/operator-load'
import canRemoteDispatch from './operator/canRemoteDispatch'
import { keys } from 'ramda'

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

export const SERIALIZE = 'SERIALIZE';
export const DESERIALIZE = 'DESERIALIZE';

export const serializeAction = () => ( { type: SERIALIZE } )
export const deserializeAction = () => ( { type: DESERIALIZE } )

export default ( { io, customerAuth, operatorAuth, agentAuth, messageMiddlewares = [], middlewares = [], timeout = undefined } ) => {
	return applyMiddleware(
			logger,
			delayedDispatch,
			controllerMiddleware( messageMiddlewares ),
			operatorMiddleware( io.of( '/operator' ), operatorAuth ),
			agentMiddleware( io.of( '/agent' ), agentAuth ),
			chatlistMiddleware( {
				io,
				timeout,
				customerDisconnectTimeout: timeout,
				customerDisconnectMessageTimeout: timeout
			}, customerAuth ),
			broadcastMiddleware( io.of( '/operator' ), canRemoteDispatch ),
			...operatorLoadMiddleware,
	)
}

// export default ( { io, customerAuth, operatorAuth, agentAuth, messageMiddlewares = [], middlewares = [], timeout = undefined }, state, reducer ) => {
// 	return createStore(
// 		reducer,
// 		state,
// 		applyMiddleware(
// 			logger,
// 			...middlewares,
// 			delayedDispatch,
// 			controllerMiddleware( messageMiddlewares ),
// 			operatorMiddleware( io.of( '/operator' ), operatorAuth ),
// 			agentMiddleware( io.of( '/agent' ), agentAuth ),
// 			chatlistMiddleware( { io, timeout, customerDisconnectTimeout: timeout, customerDisconnectMessageTimeout: timeout }, customerAuth ),
// 			broadcastMiddleware( io.of( '/operator' ), canRemoteDispatch ),
// 			...operatorLoadMiddleware,
// 		)
// 	)
// }
