import { createServer } from 'http'
import IO from 'socket.io'
import customer from './lib/customer'
// import agent from './lib/agent'

const { PORT } = process.env

const debug = require( 'debug' )( 'tinkerchat:service' )

const server = createServer()
const service = new IO( server )

customer( service.of( '/customer' ) )
agent( service.of( '/agent' ) )

server.listen( PORT || 3000, () => {
	let { address, port, family } = server.address()
	debug( `Listening on ${family} ${address}:${port}` )
} )
