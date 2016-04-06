import IO from 'socket.io'
import customer from './customer'
import agent from './agent'
import operator from './operator'
import controller from './controller'

const debug = require( 'debug' )( 'tinkerchat:main' )

export default ( server, { customerAuthenticator, agentAuthenticator, operatorAuthenticator } ) => {
	debug( 'configuring socket.io server' )
	const io = new IO( server )
	const agents = agent( io.of( '/agent' ) ).on( 'connection', agentAuthenticator )
	const customers = customer( io.of( '/customer' ) ).on( 'connection', customerAuthenticator )
	const operators = operator( io.of( '/operator' ) ).on( 'connection', operatorAuthenticator )

	controller( { customers, agents, operators } )

	return { io, agents, customers }
}
