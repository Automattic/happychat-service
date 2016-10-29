import { EventEmitter } from 'events'
import { createStore, applyMiddleware } from 'redux'
import {
	getChats
} from './selectors'
import reducer from './reducer'
import middleware from './middleware'

export class ChatList extends EventEmitter {
	constructor( { customers, operators, timeout = 1000, customerDisconnectTimeout = 90000, state = undefined } ) {
		super()

		const { getState } = this.store = createStore( reducer, state, applyMiddleware( middleware( { customers, operators, events: this } ) ) )

		// Default timeout for querying operator clients for information
		this._timeout = timeout
		this._customerDisconnectTimeout = customerDisconnectTimeout

		// event and io for customer and operator connections
		this.customers = customers
		this.operators = operators

		this.findAllOpenChats = () => getChats( getState() )
	}
}
