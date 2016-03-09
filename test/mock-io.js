import { EventEmitter } from 'events'

const debug = require( 'debug' )( 'tinkerchat:mockio' )

export default () => {
	const server = new EventEmitter()
	const socket = new EventEmitter()
	const client = new EventEmitter()

	server.to = ( room ) => ( {
		emit: ( name, ... args ) => {
			server.emit( `${room}.${name}`, ... args )
		}
	} )

	const emitClient = client.emit.bind( client )
	const emitSocket = socket.emit.bind( socket )

	socket.emit = emitClient
	client.emit = emitSocket

	socket.rooms = []
	socket.join = ( room, complete ) => {
		socket.rooms = socket.rooms.concat( room )
		process.nextTick( complete )
	}
	socket.close = () => {}

	return { server, socket, client }
}
