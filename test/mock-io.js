import { EventEmitter } from 'events'

export default () => {
	const server = new EventEmitter()
	const socket = new EventEmitter()
	const client = new EventEmitter()
	const emitClient = client.emit.bind( client )
	const emitSocket = socket.emit.bind( socket )

	socket.emit = emitClient
	client.emit = emitSocket

	return { server, socket, client }
}
