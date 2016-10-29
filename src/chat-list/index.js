import { EventEmitter } from 'events'
import { createStore, applyMiddleware } from 'redux'
import {
	getChats
} from './selectors'
import reducer from './reducer'
import middleware from './middleware'

export default ( { customers, operators, timeout = 1000, customerDisconnectTimeout = 90000, state = undefined } ) => {
	const events = new EventEmitter()
	events._timeout = timeout
	events._customerDisconnectTimeout = customerDisconnectTimeout
	const io_middleware = middleware( { customers, operators, events } )
	const store = createStore( reducer, state, applyMiddleware( io_middleware ) )

	return {
		findAllOpenChats: () => getChats( store.getState() ),
		on: events.on.bind( events ),
		once: events.once.bind( events ),
		store
	}
}
