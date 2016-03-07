import IO from 'socket.io'
import customer from './customer'
import agent from './agent'

export default ( server, { customerAuthenticator, agentAuthenticator } ) => {
	const service = new IO( server )
	const customers = customer( service.of( '/customer' ), customerAuthenticator )
	agent( service.of( '/agent' ), { customers: customers, authenticator: agentAuthenticator } )
	return service
}
