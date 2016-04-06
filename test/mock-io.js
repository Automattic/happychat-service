import { EventEmitter } from 'events'

import { get, assign, keys } from 'lodash/object'

const debug = require( 'debug' )( 'tinkerchat:mockio' )
const noop = () => {}

export default ( socketid ) => {
	const server = new EventEmitter()

	server.to = ( room ) => ( {
		emit: ( name, ... args ) => {
			server.emit( `${room}.${name}`, ... args )
		}
	} )

	server.rooms = {}

	server.in = ( room ) => {
		const sockets = get( server.rooms, room, [] )
		debug( 'requesting room', room, sockets.length )
		return {
			clients: ( cb ) => {
				// return socket ids of clients
				cb( null, sockets.map( ( socket ) => socket.id ) )
				return server
			},
			emit: ( ... args ) => {
				// TODO: if any args blah
				sockets.forEach( ( socket ) => socket.emit( ... args ) )
				return server
			}
		}
	}

	server.connected = {}
	server.connect = ( socket ) => {
		server.connected[socket.id] = socket
		process.nextTick( () => server.emit( 'connection', socket ) )
	}

	server.newClient = ( id = 'socket-io-id' ) => {
		const client = new EventEmitter()
		const socket = new EventEmitter()

		socket.id = id
		client.id = id

		const emitClient = client.emit.bind( client )
		const emitSocket = socket.emit.bind( socket )

		socket.emit = emitClient
		client.emit = emitSocket

		socket.rooms = []
		socket.join = ( room, complete ) => {
			socket.rooms = socket.rooms.concat( room )
			const newSockets = {}
			newSockets[room] = get( server.rooms, room, [] ).concat( socket )
			debug( 'room now at', room, newSockets[room].length )
			server.rooms = assign( {}, server.rooms, newSockets )
			process.nextTick( complete )
		}
		socket.close = () => {}
		return { socket, client }
	}

	server.connectNewClient = ( id = `socket-io-id ${ keys( server.connections ).count }`, next = noop ) => {
		const connection = server.newClient( id )
		const { socket } = connection
		server.once( 'connection', next )
		server.connect( socket )
		return connection
	}

	return assign( { server }, server.newClient( socketid ) )
}
