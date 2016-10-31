import { createStore, applyMiddleware, combineReducers } from 'redux'
import operatorMiddleware from 'middlewares/socket-io'
import operatorReducer from 'operator/store'
import chatlistReducer from 'chat-list/reducer'
import chatlistMiddleware from 'chat-list/middleware'

export default ( { io, customers, operators, chatlist } ) => createStore(
	combineReducers( { operators: operatorReducer(), chatlist: chatlistReducer } ),
	applyMiddleware(
		operatorMiddleware( io.of( '/operator' ), operators ),
		chatlistMiddleware( { customers, operators, events: chatlist } )
	)
)
