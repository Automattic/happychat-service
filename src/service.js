import IO from 'socket.io'
import customer from './customer'
import agent from './agent'
import controller from './controller'

const debug = require( 'debug' )( 'tinkerchat:main' )

export default ( server, { customerAuthenticator, agentAuthenticator } ) => {
	debug( 'configuring socket.io server' )
	const io = new IO( server )

	controller( {
		customers: customer( io.of( '/customer' ) ).on( 'connection', customerAuthenticator ),
		agents: agent( io.of( '/agent' ) ).on( 'connection', agentAuthenticator )
	} )

	return io
}
