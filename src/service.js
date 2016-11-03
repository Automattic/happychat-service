import { EventEmitter } from 'events'
import IO from 'socket.io'
import agent from './agent'
import operator from './operator'
import buildController from './controller'
import createStore from './store'

const debug = require( 'debug' )( 'happychat:main' )

export default ( server, { customerAuthenticator, agentAuthenticator, operatorAuthenticator } ) => {
	debug( 'configuring socket.io server' )

	const io = new IO( server )

	const operatorEvents = new EventEmitter()
	const customers = new EventEmitter()
	const chatlistEvents = new EventEmitter()

	const store = createStore( {
		io,
		operators: operatorEvents,
		customers,
		chatlist: chatlistEvents
	} );

	const agents = agent( io.of( '/agent' ) ).on( 'connection', agentAuthenticator )
	customers.on( 'connection', customerAuthenticator )
	const operators = operator( io.of( '/operator' ), operatorEvents, store ).on( 'connection', operatorAuthenticator )

	const controller = buildController( {
		customers,
		agents,
		operators,
		store
	} )

	return { io, agents, customers, operators, controller, store }
}
