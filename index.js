import { createServer } from 'http'
import service from './lib/service'

const { PORT } = process.env
const debug = require( 'debug' )( 'tinkerchat:service' )

const server = createServer()

service( server )

server.listen( PORT || 3000, () => {
	let { address, port, family } = server.address()
	debug( `Listening on ${family} ${address}:${port}` )
} )
