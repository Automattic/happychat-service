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

export default ( { io, customers, operators, chatlist, agents, messageMiddlewares = [], middlewares = [], timeout = undefined }, state ) => createStore(
	combineReducers( { operators: operatorReducer, chatlist: chatlistReducer } ),
	state,
	applyMiddleware(
		...middlewares,
		controllerMiddleware( { customers, agents, operators, middlewares: messageMiddlewares } ),
		operatorMiddleware( io.of( '/operator' ), operators ),
		agentMiddleware( io.of( '/agent' ), agents ),
		chatlistMiddleware( { io, customers, operators, events: chatlist, timeout, customerDisconnectTimeout: timeout } ),
		broadcastMiddleware( io.of( '/operator' ), canRemoteDispatch ),
		...operatorLoadMiddleware,
	)
)
