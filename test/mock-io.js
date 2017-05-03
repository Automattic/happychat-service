import { EventEmitter } from 'events';

import { isEmpty, values, compose, flatten, map, prop } from 'ramda';

import get from 'lodash/get';
import set from 'lodash/set';
import assign from 'lodash/assign';
import forEach from 'lodash/forEach';
import reject from 'lodash/reject';

const debug = require( 'debug' )( 'happychat:test:mockio' );
const noop = () => {};

let COUNTER = 0;

const PRIVATE_EVENTS = [ 'connection', 'connect' ];

class Server extends EventEmitter {
	constructor( ns = '/' ) {
		super();
		this.rooms = {};
		this.connected = {};
		this.namespace = ns;
		this.to = this.in.bind( this );
		this.in_rooms = [];
		this.emit = ( ... args ) => {
			if ( ~PRIVATE_EVENTS.indexOf( args[ 0 ] ) ) {
				EventEmitter.prototype.emit.apply( this, args );
			} else {
				this.doEmit( ... args );
			}
			return this;
		};
	}

	socketsForRoomScope( ) {
		let sockets = [];
		if ( isEmpty( this.in_rooms ) ) {
			sockets = values( this.connected );
		} else {
			sockets = compose(
				flatten,
				map( room => get( this.rooms, room, [] ) )
			)( this.in_rooms );
		}
		return sockets;
	}

	doEmit( ... args ) {
		const sockets = this.socketsForRoomScope();
		for ( const socket of sockets ) {
			socket.emit( ... args );
		}
		this.in_rooms = [];
	}

	in( room ) {
		if ( ! ~this.in_rooms.indexOf( room ) ) {
			this.in_rooms.push( room );
		}
		return this;
	}

	clients( cb ) {
		// TODO: this should filter to rooms
		const sockets = this.socketsForRoomScope();
		process.nextTick( () => cb( null, map( prop( 'id' ), sockets ) ) );
	}

	connect( socket ) {
		debug( 'connecting', this.namespace, socket.id );
		this.connected[ socket.id ] = socket;
		socket.join( socket.id, () => {
			this.emit( 'connection', socket );
			socket.emit( 'connect' );
		} );
	}

	newClient( id ) {
		if ( id === undefined ) {
			id = `socket-io-id-${ COUNTER }`;
		}
		COUNTER++;
		const client = new EventEmitter();
		const socket = new EventEmitter();

		socket.id = id;
		client.id = id;

		const emitClient = client.emit.bind( client );
		const emitSocket = socket.emit.bind( socket );

		socket.emit = emitClient;
		client.emit = emitSocket;

		socket.rooms = [];
		socket.join = ( room, complete ) => {
			socket.rooms = socket.rooms.concat( room );
			const newSockets = {};
			newSockets[ room ] = get( this.rooms, room, [] ).concat( socket );
			this.rooms = assign( {}, this.rooms, newSockets );
			complete ? process.nextTick( complete ) : null;
			return socket;
		};
		socket.leave = ( room, complete ) => {
			socket.rooms = reject( socket.rooms, room );
			const newSockets = {};
			newSockets[ room ] = reject( get( this.rooms, room, [] ), socket );
			this.rooms = assign( {}, this.rooms, newSockets );
			process.nextTick( complete );
		};
		socket.close = () => {};
		client.disconnect = socket.disconnect = () => {
			this.disconnect( { socket, client } );
		};
		client.connect = socket.connect = () => {
			this.connect( socket );
		};
		return { socket, client };
	}

	connectNewClient( id, next = noop ) {
		const connection = this.newClient( id );
		const { socket } = connection;
		this.once( 'connection', next );
		this.connect( socket );
		return connection;
	}

	disconnect( { socket, client } ) {
		debug( 'DISCONNECTING SOCKET', socket.id );
		forEach( socket.rooms, ( room ) => {
			debug( 'disconnecting and removing from room', socket.id, room );
			this.rooms[ room ] = reject( this.rooms[ room ], socket );
		} );
		socket.rooms = [];
		delete this.connected[ socket.id ];
		process.nextTick( () => {
			socket.emit( 'disconnect' );
			client.emit( 'disconnect' );
			this.emit( 'disconnect', socket );
		} );
	}

}

export default ( socketid ) => {
	const server = new Server( '/' );

	server.namespaces = {};
	server.of = ( name ) => {
		let ns = get( server.namespaces, name );
		if ( ns ) {
			return ns;
		}
		ns = new Server( name );
		set( server.namespaces, name, ns );
		return ns;
	};
	return assign( { server }, server.newClient( socketid ) );
};
