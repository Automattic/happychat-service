import { createStore, applyMiddleware, combineReducers } from 'redux'
import operatorMiddleware from '../middlewares/socket-io'
import chatlistMiddleware from '../middlewares/socket-io/chatlist'
import broadcastMiddleware from '../middlewares/socket-io/broadcast'
import operatorReducer from '../operator/store'
import chatlistReducer from '../chat-list/reducer'
import canRemoteDispatch from '../operator/canRemoteDispatch'

export default ( { io, customers, operators, chatlist, middlewares = [] } ) => createStore(
	combineReducers( { operators: operatorReducer(), chatlist: chatlistReducer } ),
	applyMiddleware(
		operatorMiddleware( io.of( '/operator' ), operators ),
		chatlistMiddleware( { customers, operators, events: chatlist } ),
		broadcastMiddleware( io.of( '/operator' ), canRemoteDispatch ),
		...middlewares
	)
)
