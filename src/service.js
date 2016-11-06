import { EventEmitter } from 'events'
import IO from 'socket.io'
import createStore from './store'
import middlewareInterface from './middleware-interface'

const debug = require( 'debug' )( 'happychat:main' )

export default ( server, { customerAuthenticator, agentAuthenticator, operatorAuthenticator } ) => {
	debug( 'configuring socket.io server' )

	const io = new IO( server )

	const customers = new EventEmitter()
	const operators = new EventEmitter()
	const chatlistEvents = new EventEmitter()
	const agents = new EventEmitter()

	const middlewares = middlewareInterface()

	const store = createStore( {
		io,
		operators,
		customers,
		agents,
		chatlist: chatlistEvents,
		messageMiddlewares: middlewares.middlewares()
	} );

	agents.on( 'connection', agentAuthenticator )
	customers.on( 'connection', customerAuthenticator )
	operators.on( 'connection', operatorAuthenticator )

	return { io, agents, customers, operators, controller: middlewares.external, store }
}
