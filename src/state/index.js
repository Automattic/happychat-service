import delayedDispatch from 'redux-delayed-dispatch';
import { applyMiddleware } from 'redux'

import socketioMiddleware from './middlewares/socket-io'
import systemMiddleware from './middlewares/system'
import logger from './middlewares/logger'
import { DESERIALIZE, SERIALIZE } from './action-types'

export const serializeAction = () => ( { type: SERIALIZE } )
export const deserializeAction = () => ( { type: DESERIALIZE } )

export default ( { io, customerAuth, operatorAuth, agentAuth, messageMiddlewares = [], timeout = undefined }, middlewares = [] ) => {
	return applyMiddleware(
		logger,
		... middlewares,
		delayedDispatch,
		... socketioMiddleware( { io, customerAuth, operatorAuth, agentAuth, messageMiddlewares, timeout } ),
		...systemMiddleware( messageMiddlewares, timeout ),
	)
}
