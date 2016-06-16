import { EventEmitter } from 'events'

import get from 'lodash/get'
import assign from 'lodash/assign'
import keys from 'lodash/keys'
import forEach from 'lodash/forEach'
import reject from 'lodash/reject'

const debug = require( 'debug' )( 'happychat:test:mockio' )
const noop = () => {}

var COUNTER = 0

export default ( socketid ) => {
	const server = new EventEmitter()

	server.rooms = {}

	server.to = ( room ) => ( {
		emit: ( ... args ) => {
			get( server.rooms, room, [] ).forEach( ( socket ) => {
				socket.emit( ... args )
			} )
		}
	} )

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

	server.clients = ( cb ) => {
		cb( null, keys( get( server, 'connected', {} ) ) )
	}

	server.connected = {}
	server.connect = ( socket ) => {
		server.connected[socket.id] = socket
		process.nextTick( () => server.emit( 'connection', socket ) )
	}

	server.newClient = ( id ) => {
		if ( id === undefined ) id = `socket-io-id-${ COUNTER }`
		COUNTER ++
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

	server.connectNewClient = ( id, next = noop ) => {
		const connection = server.newClient( id )
		const { socket } = connection
		server.once( 'connection', next )
		server.connect( socket )
		return connection
	}

	server.disconnect = ( { socket, client } ) => {
		debug( 'disconnect client and leave rooms', socket.id, client.id )
		forEach( socket.rooms, ( room ) => {
			debug( 'removing', socket.id, 'from', room, server.rooms[room] )
			server.rooms[room] = reject( server.rooms[room], socket )
		} )
		socket.rooms = []
		delete server.connected[socket.id]
		process.nextTick( () => {
			socket.emit( 'disconnect' )
			client.emit( 'disconnect' )
			server.emit( 'disconnect', socket )
		} )
	}

	return assign( { server }, server.newClient( socketid ) )
}
