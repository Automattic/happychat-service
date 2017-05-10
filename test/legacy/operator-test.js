import { ok, equal, deepEqual } from 'assert';
import { createStore, compose, applyMiddleware } from 'redux';
import { values } from 'ramda';
import mockio from '../mock-io';
import map from 'lodash/map';
import reduce from 'lodash/reduce';
import enhancer from 'state';
import { reducer } from 'service';
import broadcast, { selector } from 'broadcast';
import WatchingMiddleware from '../mock-middleware';
import {
	SET_USER_OFFLINE,
	OPERATOR_RECEIVE_TYPING,
	OPERATOR_CHAT_LEAVE,
	OPERATOR_CHAT_TRANSCRIPT_REQUEST,
	OPERATOR_INBOUND_MESSAGE,
	SET_CHAT_OPERATOR,
	INSERT_PENDING_CHAT,
	OPERATOR_READY,
	SET_OPERATOR_STATUS,
	SET_OPERATOR_CAPACITY,
	CUSTOMER_BLOCK
} from 'state/action-types';
import {
	setAcceptsCustomers,
	operatorChatJoin
} from 'state/operator/actions';
import { selectTotalCapacity } from 'state/operator/selectors';
import { insertPendingChat, closeChat } from 'state/chatlist/actions';
import { getGroups } from 'state/groups/selectors';

const debug = require( 'debug' )( 'happychat:operator-test' );

describe( 'Operators', () => {
	const socketid = 'socket-id';
	let socket, client, server, store, io, watchingMiddleware;
	let auth;
	const doAuth = () => auth();

	const connectOperator = ( { socket: useSocket, client: useClient }, authUser = { id: 'user-id', displayName: 'name' } ) => new Promise( resolve => {
		auth = () => Promise.resolve( authUser );
		useClient
		.once( 'init', ( clientUser ) => {
			debug( 'init user', clientUser );
			resolve( { user: clientUser, client: useClient, socket: useSocket } );
		} );
		server.connect( useSocket );
	} );

	const watchForType = ( ... args ) => {
		watchingMiddleware.watchForType( ... args );
	};

	const watchForTypeOnce = ( ... args ) => {
		watchingMiddleware.watchForTypeOnce( ... args );
	};

	beforeEach( () => {
		( { server: io } = mockio( socketid ) );
		server = io.of( '/operator' );
		( { socket, client } = server.newClient( socketid ) );
		watchingMiddleware = new WatchingMiddleware();
		// Need to add a real socket io middleware here
		store = createStore( reducer, compose(
			enhancer( {
				io,
				operatorAuth: doAuth
			} ),
			applyMiddleware( watchingMiddleware.middleware() )
		) );
		broadcast( store, io.of( '/operator' ) );
	} );

	it( 'should send current state to operator', done => {
		const connection = server.newClient( socketid );
		connection.client.once( 'broadcast.update', ( lastVersion, nextVersion ) => {
			process.nextTick( () => {
				connection.client.once( 'broadcast.state', ( version, state ) => {
					equal( version, nextVersion );
					deepEqual( state, selector( store.getState() ) );
					done();
				} );
				connection.client.emit( 'broadcast.state' );
			} );
		} );
		return connectOperator( connection );
	} );

	describe( 'when authenticated and online', () => {
		const op = { id: 'user-id', displayName: 'furiosa', avatarURL: 'url', priv: 'var', status: 'online', load: 1, capacity: 3 };
		beforeEach( () => connectOperator( { socket, client }, op ) );

		it( 'should set user offline when last socket disconnects', ( done ) => {
			watchForType( SET_USER_OFFLINE, action => {
				equal( action.user.id, op.id );
				done();
			} );
			client.disconnect();
		} );

		it( 'should emit message', ( done ) => {
			watchForType( OPERATOR_INBOUND_MESSAGE, action => {
				const { message, chat_id, user } = action;
				const { id, displayName, avatarURL, priv } = user;
				const { text, user: author } = message;

				ok( id );
				ok( displayName );
				ok( avatarURL );
				ok( priv );
				ok( ! author.priv );
				equal( chat_id, 'chat-id' );
				equal( text, 'message' );
				done();
			} );
			client.emit( 'message', 'chat-id', { id: 'message-id', text: 'message' } );
		} );

		it( 'should handle `chat.typing` from client and pass to events', ( done ) => {
			watchForType( OPERATOR_RECEIVE_TYPING, action => {
				const { id, user, text } = action;
				equal( id, 'chat-id' );
				equal( user.id, op.id );
				equal( text, 'typing a message...' );
				done();
			} );

			client.emit( 'chat.typing', 'chat-id', 'typing a message...' );
		} );

		it( 'should fail to remote dispatch', done => {
			client.emit( 'broadcast.dispatch', { type: 'UNKNOWN' }, ( error ) => {
				equal( error, 'Remote dispatch not allowed' );
				done();
			} );
		} );

		it( 'should allow remote dispatch', done => {
			client.emit( 'broadcast.dispatch', setAcceptsCustomers( true ), ( error ) => {
				equal( error, null );
				ok( store.getState().operators.system.acceptsCustomers );
				done();
			} );
		} );
	} );

	it( 'should dispatch operator ready after connecting', ( done ) => {
		watchForType( OPERATOR_READY, action => {
			equal( action.user.id, 'a-user' );
			ok( action.socket_id );
			ok( action.room );
			done();
		} );
		connectOperator( server.newClient(), { id: 'a-user' } ).catch( done );
	} );

	describe( 'with multiple connections from same operator', () => {
		let connections;
		const op = { id: 'user-id', displayName: 'furiosa', avatarURL: 'url', priv: 'var' };

		const connectAllClientsToChat = ( chat, opUser ) => Promise.all(
			map( connections, ( { client: opClient } ) => new Promise( resolve => {
				opClient.once( 'chat.open', _chat => resolve( _chat ) );
				store.dispatch( operatorChatJoin( chat.id, opUser ) );
			} ) )
		);

		beforeEach( () => {
			connections = [];
			return connectOperator( server.newClient(), op )
			.then( ( conn ) => {
				connections.push( conn );
				return connectOperator( server.newClient(), op );
			} )
			.then( conn => new Promise( ( resolve ) => {
				connections.push( conn );
				resolve();
			} ) );
		} );

		it( 'should not emit leave when one socket disconnects', () => {
			return new Promise( ( resolve, reject ) => {
				const [ connection ] = connections;
				const { client: c, socket: s } = connection;
				watchForType( OPERATOR_CHAT_LEAVE, () => {
					reject( new Error( 'there are still clients connected' ) );
				} );
				c.on( 'disconnect', () => {
					resolve();
				} );
				server.in( 'operator/user-id' ).clients( ( e, clients ) => {
					equal( clients.length, 2 );
					server.disconnect( { client: c, socket: s } );
				} );
			} );
		} );

		describe( 'with assigned chat', () => {
			beforeEach( () => {
				return new Promise( resolve => {
					watchForType( INSERT_PENDING_CHAT, action => {
						resolve( action.chat );
					}, true );
					store.dispatch( insertPendingChat( { id: 'chat-id' } ) );
				} )
				.then( chat => connectAllClientsToChat( chat, op ) );
			} );

			it( 'should emit chat.close to all clients in a chat', () => {
				return Promise.resolve( connections )
				.then( clients => {
					const all = Promise.all( map( clients, ( { client: opClient } ) => new Promise( resolve => {
						opClient.once( 'chat.close', ( chat, opUser ) => {
							resolve( { chat, operator: opUser, client: opClient } );
						} );
					} ) ) );
					store.dispatch( closeChat( 'chat-id', op ) );
					return all;
				} )
				.then( ( messages ) => {
					equal( messages.length, 2 );
					for ( const message of messages ) {
						deepEqual( message.chat.id, 'chat-id' );
						deepEqual( message.operator, op );
					}
				} );
			} );

			it( 'should dispatch customerBlock when operator emits chat.block', done => {
				watchForType( CUSTOMER_BLOCK, action => {
					equal( action.chat_id, 'chat' );
					done();
				} );
				connections[ 0 ].client.emit( 'chat.block', 'chat' );
			} );
		} );

		it( 'should request transcript for chat', () => new Promise( resolve => {
			const [ connection ] = connections;
			watchForType( OPERATOR_CHAT_TRANSCRIPT_REQUEST, action => {
				equal( action.timestamp, 'timestamp' );
				equal( action.chat_id, 'chat-id' );
				resolve();
			} );
			connection.client.emit( 'chat.transcript', 'chat-id', 'timestamp', () => {} );
		} ) );
	} );

	describe( 'with multiple connected users', () => {
		const ops = [
			{ id: 'hermione', displayName: 'Hermione', avatarURL: 'url', status: 'available', capacity: 4 },
			{ id: 'ripley', displayName: 'Ripley', avatarURL: 'url', status: 'available', capacity: 1 },
			{ id: 'nausica', displayName: 'Nausica', avatarURL: 'url', status: 'available', capacity: 1 },
			{ id: 'furiosa', displayName: 'Furiosa', avatarURL: 'url', status: 'available', capacity: 5 },
			{ id: 'river', displayName: 'River Tam', status: 'available', capacity: 6 },
			{ id: 'buffy', displayName: 'Buffy', status: 'offline', capacity: 20 }
		];

		const assign = ( chat_id ) => new Promise( resolve => {
			watchForTypeOnce( SET_CHAT_OPERATOR, action => {
				resolve( action.operator );
			} );
			store.dispatch( insertPendingChat( { id: chat_id } ) );
		} );

		const collectPromises = ( ... promises ) => new Promise( ( resolve, reject ) => {
			const results = [];
			reduce( promises, ( promise, nextPromise ) => {
				return promise.then( result => {
					if ( result !== undefined ) {
						results.push( result );
					}
					return nextPromise();
				} );
			}, Promise.resolve() )
			.then( result => {
				resolve( results.concat( [ result ] ) );
			}, reject );
		} );

		const connectAll = () => collectPromises( ... ops.map(
			op => () => new Promise( ( resolve, reject ) => {
				const io_client = server.newClient();
				io_client.client
				.on( 'init', () => {
					io_client.client.emit( 'broadcast.dispatch', {
						type: SET_OPERATOR_STATUS, status: op.status
					}, () => {
						io_client.client.emit( 'broadcast.dispatch', {
							type: SET_OPERATOR_CAPACITY, locale: 'en-US', capacity: op.capacity
						}, () => resolve( op ) );
					} );
				} );
				connectOperator( io_client, op ).catch( reject );
			} )
		) );

		beforeEach( () => connectAll() );

		const assignChats = ( total = 10 ) => {
			const promises = [];
			for ( let i = 0; i < total; i++ ) {
				promises.push( () => assign( 'chat-' + i ) );
			}
			return collectPromises( ... promises );
		};

		// Starting loads currently can't be set so the expected calculations are off
		it( 'should assign operators in correct order', () => assignChats( 9 ).then( results => {
			deepEqual(
				map( results, ( { id } ) => id ),
				[
					'river',    // 0/6 => 1/6
					'furiosa',  // 0/5 => 1/5
					'hermione', // 0/4 => 1/4
					'ripley',   // 0/1 => 1/1
					'nausica',  // 0/1 => 1/1
					'river',    // 1/6 => 2/6
					'furiosa',  // 1/5 => 2/5
					'hermione', // 1/4 => 2/4
					'river',    // 2/6 => 3/6
				]
			);
		} ) );

		it( 'should calculate locale capacity', () => {
			deepEqual( selectTotalCapacity( 'en-US', values( getGroups( store.getState() ) ), store.getState() ), {
				load: 0,
				capacity: 17
			} );
		} );
	} );
} );
