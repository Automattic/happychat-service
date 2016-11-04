import { EventEmitter } from 'events'
import IO from 'socket.io'
import agent from './agent'
import buildController from './controller'
import createStore from './store'

const debug = require( 'debug' )( 'happychat:main' )

export default ( server, { customerAuthenticator, agentAuthenticator, operatorAuthenticator } ) => {
	debug( 'configuring socket.io server' )

	const io = new IO( server )

	const customers = new EventEmitter()
	const operators = new EventEmitter()
	const chatlistEvents = new EventEmitter()

	const store = createStore( {
		io,
		operators,
		customers,
		chatlist: chatlistEvents
	} );

	const agents = agent( io.of( '/agent' ) ).on( 'connection', agentAuthenticator )
	customers.on( 'connection', customerAuthenticator )
	operators.on( 'connection', operatorAuthenticator )

	const controller = buildController( {
		customers,
		agents,
		operators,
		store
	} )

	return { io, agents, customers, operators, controller, store }
}
