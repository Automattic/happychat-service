import delayedDispatch from 'redux-delayed-dispatch';
import { applyMiddleware } from 'redux';

import socketioMiddleware from './middlewares/socket-io';
import systemMiddleware from './middlewares/system';
import logger from './middlewares/logger';
import { DESERIALIZE, SERIALIZE } from './action-types';
import { run } from '../middleware-interface';

export const serializeAction = () => ( { type: SERIALIZE } );
export const deserializeAction = () => ( { type: DESERIALIZE } );

export default ( { io, customerAuth, operatorAuth, agentAuth, messageFilters = [], timeout = undefined }, middlewares = [], logCacheBuilder ) => {
	// const runMiddleware = ( ... args ) => run( filters )( ... args ).then(
	// 	message => {
	// 		if ( !! message ) {
	// 			return message;
	// 		}
	// 		return Promise.reject( message );
	// 	}
	// );

	const messageFilter = ( ... args ) => run( messageFilters )( ... args );
	return applyMiddleware(
		// logs dispatches
		logger,
		// allows middleware to be injected
		... middlewares,
		// middlware for dispatching in the future and cancelling scheduled dispatches
		delayedDispatch,
		// enables interface for socket.io clients
		... socketioMiddleware( { io, customerAuth, operatorAuth, agentAuth, messageFilter, timeout } ),
		// core middlewares enabling support chat
		...systemMiddleware( messageFilter, timeout, logCacheBuilder ),
	);
};

