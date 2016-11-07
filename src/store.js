import { createStore, applyMiddleware, combineReducers } from 'redux'
import operatorMiddleware from './middlewares/socket-io'
import chatlistMiddleware from './middlewares/socket-io/chatlist'
import broadcastMiddleware from './middlewares/socket-io/broadcast'
import agentMiddleware from './middlewares/socket-io/agents'
import controllerMiddleware from './middlewares/socket-io/controller'
import operatorLoadMiddleware from './middlewares/socket-io/operator-load'
import operatorReducer from './operator/reducer'
import chatlistReducer from './chat-list/reducer'
import canRemoteDispatch from './operator/canRemoteDispatch'
import { keys } from 'ramda'

const debug = require( 'debug' )( 'happychat:store' )
const logger = ( { getState } ) => next => action => {
	debug( 'ACTION_START', action.type, ... keys( action ) )
	try {
		const result = next( action )
		debug( 'ACTION_END', action.type )
		return result
	} catch ( e ) {
		debug( 'ACTION_ERROR', action.type, e )
		debug( 'ACTION', action )
		debug( 'STATE', JSON.stringify( getState(), null, '  ' ) )
		throw ( e )
	}
}

export default ( { io, customerAuth, operatorAuth, agentAuth, messageMiddlewares = [], middlewares = [], timeout = undefined }, state ) => createStore(
	combineReducers( { operators: operatorReducer, chatlist: chatlistReducer } ),
	state,
	applyMiddleware(
		logger,
		...middlewares,
		controllerMiddleware( messageMiddlewares ),
		operatorMiddleware( io.of( '/operator' ), operatorAuth ),
		agentMiddleware( io.of( '/agent' ), agentAuth ),
		chatlistMiddleware( { io, timeout, customerDisconnectTimeout: timeout }, customerAuth ),
		broadcastMiddleware( io.of( '/operator' ), canRemoteDispatch ),
		...operatorLoadMiddleware,
	)
)
