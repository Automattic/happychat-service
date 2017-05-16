import delayedDispatch from 'redux-delayed-dispatch';
import { evolve, filter, compose, equals, not, anyPass } from 'ramda'
import { applyMiddleware } from 'redux'

import operatorMiddleware from './middlewares/socket-io/operator'
import chatlistMiddleware from './middlewares/socket-io/chatlist'
import broadcastMiddleware from './middlewares/socket-io/broadcast'
import agentMiddleware from './middlewares/socket-io/agents'
import controllerMiddleware from './middlewares/system/controller'
import systemMiddleware from './middlewares/system'
import canRemoteDispatch from './operator/can-remote-dispatch'
import shouldBroadcastStateChange from './should-broadcast'
import { DESERIALIZE, SERIALIZE } from './action-types'
import { STATUS_CLOSED, STATUS_NEW, statusView } from './chatlist/reducer'

const filterClosed = filter( compose(
	not,
	anyPass( [ equals( STATUS_CLOSED ), equals( STATUS_NEW ) ] ),
	statusView,
) )

const selector = evolve( { chatlist: filterClosed } )

export const serializeAction = () => ( { type: SERIALIZE } )
export const deserializeAction = () => ( { type: DESERIALIZE } )

export default ( { io, customerAuth, operatorAuth, agentAuth, messageFilters = [], timeout = undefined }, middlewares = [], measure = ( key, fn ) => fn ) => {
	return applyMiddleware(
			delayedDispatch,
			... middlewares,
			controllerMiddleware( messageFilters ),
			operatorMiddleware( io.of( '/operator' ), operatorAuth, messageFilters ),
			agentMiddleware( io.of( '/agent' ), agentAuth ),
			chatlistMiddleware( {
				io,
				timeout,
				customerDisconnectTimeout: timeout,
				customerDisconnectMessageTimeout: timeout
			}, customerAuth, messageFilters ),
			broadcastMiddleware( io.of( '/operator' ), { canRemoteDispatch, shouldBroadcastStateChange, selector }, measure( 'broadcast' ) ),
			...systemMiddleware
	)
}
