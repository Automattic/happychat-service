import delayedDispatch from 'redux-delayed-dispatch';
import { applyMiddleware } from 'redux';

import socketioMiddleware from './middlewares/socket-io';
import systemMiddleware from './middlewares/system';
import logger from './middlewares/logger';
import { DESERIALIZE, SERIALIZE } from './action-types';

export const serializeAction = () => ( { type: SERIALIZE } );
export const deserializeAction = () => ( { type: DESERIALIZE } );

export default ( { io, customerAuth, operatorAuth, agentAuth, messageMiddlewares = [], timeout = undefined }, middlewares = [], logCacheBuilder ) => {
	return applyMiddleware(
		// logs dispatches
		logger,
		// allows middleware to be injected
		... middlewares,
		// middlware for dispatching in the future and cancelling scheduled dispatches
		delayedDispatch,
		// enables interface for socket.io clients
		... socketioMiddleware( { io, customerAuth, operatorAuth, agentAuth, messageMiddlewares, timeout } ),
		// core middlewares enabling support chat
		...systemMiddleware( messageMiddlewares, timeout, logCacheBuilder ),
	);
};
