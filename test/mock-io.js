import { EventEmitter } from 'events'

import get from 'lodash/get'
import set from 'lodash/set'
import assign from 'lodash/assign'
import keys from 'lodash/keys'
import forEach from 'lodash/forEach'
import reject from 'lodash/reject'

const debug = require( 'debug' )( 'happychat:test:mockio' )
const noop = () => {}

var COUNTER = 0

class Server extends EventEmitter {
	constructor( ns = '/' ) {
		super()
		this.rooms = {}
		this.connected = {}
		this.namespace = ns
	}

	to( room ) {
		return {
			emit: ( ... args ) => {
				get( this.rooms, room, [] ).forEach( ( socket ) => {
					socket.emit( ... args )
				} )
			}
		}
	}

	in( room ) {
		const sockets = get( this.rooms, room, [] )
		debug( 'requesting room', room, sockets.length )
		return {
			clients: ( cb ) => {
				// return socket ids of clients
				cb( null, sockets.map( ( socket ) => socket.id ) )
				return this
			},
			emit: ( ... args ) => {
				sockets.forEach( ( socket ) => socket.emit( ... args ) )
				return this
			}
		}
	}

	clients( cb ) {
		cb( null, keys( get( this, 'connected', {} ) ) )
	}

	connect( socket ) {
		debug( 'connecting', this.namespace, socket.id )
		this.connected[socket.id] = socket
		process.nextTick( () => this.emit( 'connection', socket ) )
	}

	newClient( id ) {
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
			newSockets[room] = get( this.rooms, room, [] ).concat( socket )
			this.rooms = assign( {}, this.rooms, newSockets )
			process.nextTick( complete )
		}
		socket.leave = ( room, complete ) => {
			socket.rooms = reject( socket.rooms, room )
			const newSockets = {}
			newSockets[room] = reject( get( this.rooms, room, [] ), socket )
			this.rooms = assign( {}, this.rooms, newSockets )
			process.nextTick( complete )
		}
		socket.close = () => {}
		return { socket, client }
	}

	connectNewClient( id, next = noop ) {
		const connection = this.newClient( id )
		const { socket } = connection
		this.once( 'connection', next )
		this.connect( socket )
		return connection
	}

	disconnect( { socket, client } ) {
		forEach( socket.rooms, ( room ) => {
			this.rooms[room] = reject( this.rooms[room], socket )
		} )
		socket.rooms = []
		delete this.connected[socket.id]
		process.nextTick( () => {
			socket.emit( 'disconnect' )
			client.emit( 'disconnect' )
			this.emit( 'disconnect', socket )
		} )
	}

}

export default ( socketid ) => {
	const server = new Server()

	server.namespaces = {}
	server.of = ( name ) => {
		let ns = get( server.namespaces, name )
		if ( ns ) {
			return ns
		}
		ns = new Server( name )
		set( server.namespaces, name, ns )
		return ns
	}
	return assign( { server }, server.newClient( socketid ) )
}
