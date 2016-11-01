import { createStore, applyMiddleware, combineReducers } from 'redux'
import operatorMiddleware from '../middlewares/socket-io'
import chatlistMiddleware from '../middlewares/socket-io/chatlist'
import operatorReducer from '../operator/store'
import chatlistReducer from '../chat-list/reducer'

export default ( { io, customers, operators, chatlist } ) => createStore(
	combineReducers( { operators: operatorReducer(), chatlist: chatlistReducer } ),
	applyMiddleware(
		operatorMiddleware( io.of( '/operator' ), operators ),
		chatlistMiddleware( { customers, operators, events: chatlist } )
	)
)
