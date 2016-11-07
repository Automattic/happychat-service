import { ok, equal, deepEqual } from 'assert'
import mockio from '../mock-io'
import map from 'lodash/map'
import reduce from 'lodash/reduce'
import createStore from 'store'
import WatchingMiddleware from '../mock-middleware'
import { INSERT_PENDING_CHAT } from 'chat-list/actions'
import {
	setAcceptsCustomers,
	operatorChatJoin,
	operatorChatClose,
	REMOVE_USER,
	OPERATOR_RECEIVE_TYPING,
	OPERATOR_CHAT_LEAVE
} from 'operator/actions'
import { selectTotalCapacity } from 'operator/selectors'
import {
	insertPendingChat,
	OPERATOR_INBOUND_MESSAGE,
	SET_CHAT_OPERATOR
} from 'chat-list/actions'
import { OPERATOR_READY } from 'operator/actions'
import { STATUS_AVAILABLE } from 'middlewares/socket-io'

const debug = require( 'debug' )( 'happychat:operator' )

describe( 'Operators', () => {
	let socketid = 'socket-id'
	let socket, client, server, store, io, watchingMiddleware
	let auth
	let doAuth = () => auth()

	const connectOperator = ( { socket: useSocket, client: useClient }, authUser = { id: 'user-id', displayName: 'name' } ) => new Promise( resolve => {
		auth = () => Promise.resolve( authUser )
		useClient
		.once( 'init', ( clientUser ) => {
			debug( 'init user', clientUser )
			resolve( { user: clientUser, client: useClient, socket: useSocket } )
		} )
		server.connect( useSocket )
	} )

	const watchForType = ( ... args ) => {
		watchingMiddleware.watchForType( ... args )
	}

	const watchForTypeOnce = ( ... args ) => {
		watchingMiddleware.watchForTypeOnce( ... args )
	}

	beforeEach( () => {
		( { server: io } = mockio( socketid ) )
		server = io.of( '/operator' );
		( { socket, client } = server.newClient( socketid ) )
		watchingMiddleware = new WatchingMiddleware()
		// Need to add a real socket io middleware here
		store = createStore( {
			io,
			operatorAuth: doAuth,
			middlewares: [ watchingMiddleware.middleware() ]
		} )
	} )

	it( 'should send current state to operator', done => {
		const connection = server.newClient( socketid )
		connection.client.on( 'broadcast.state', ( version, state ) => {
			ok( version )
			deepEqual( state, store.getState() )
			done()
		} )
		return connectOperator( connection )
	} )

	describe( 'when authenticated and online', () => {
		let op = { id: 'user-id', displayName: 'furiosa', avatarURL: 'url', priv: 'var', status: 'online', load: 1, capacity: 3 }
		beforeEach( () => connectOperator( { socket, client }, op ) )

		it( 'should remove user when last socket disconnects', ( done ) => {
			watchForType( REMOVE_USER, action => {
				equal( action.user.id, op.id )
				done()
			} )
			client.disconnect()
		} )

		it( 'should emit message', ( done ) => {
			watchForType( OPERATOR_INBOUND_MESSAGE, action => {
				const { message, chat_id, user } = action
				const { id, displayName, avatarURL, priv } = user
				const { text, user: author } = message

				ok( id )
				ok( displayName )
				ok( avatarURL )
				ok( priv )
				ok( ! author.priv )
				equal( chat_id, 'chat-id' )
				equal( text, 'message' )
				done()
			} )
			client.emit( 'message', 'chat-id', { id: 'message-id', text: 'message' } )
		} )

		it( 'should handle `chat.typing` from client and pass to events', ( done ) => {
			watchForType( OPERATOR_RECEIVE_TYPING, action => {
				const { id, user, text } = action
				equal( id, 'chat-id' )
				equal( user.id, op.id )
				equal( text, 'typing a message...' )
				done()
			} )

			client.emit( 'chat.typing', 'chat-id', 'typing a message...' );
		} )

		it( 'should fail to remote dispatch', done => {
			client.emit( 'broadcast.dispatch', { type: 'UNKNOWN' }, ( error ) => {
				equal( error, 'Remote dispatch not allowed' )
				done()
			} )
		} )

		it( 'should allow remote dispatch', done => {
			client.emit( 'broadcast.dispatch', setAcceptsCustomers( true ), ( error ) => {
				equal( error, null )
				ok( store.getState().operators.system.acceptsCustomers )
				done()
			} )
		} )
	} )

	it( 'should dispatch operator ready after connecting', ( done ) => {
		watchForType( OPERATOR_READY, action => {
			equal( action.user.id, 'a-user' )
			ok( action.socket )
			ok( action.room )
			done()
		} )
		connectOperator( server.newClient(), { id: 'a-user' } ).catch( done )
	} )

	describe( 'with multiple connections from same operator', () => {
		let connections
		let op = { id: 'user-id', displayName: 'furiosa', avatarURL: 'url', priv: 'var' }

		const connectAllClientsToChat = ( chat, opUser ) => Promise.all(
			map( connections, ( { client: opClient } ) => new Promise( resolve => {
				opClient.once( 'chat.open', _chat => resolve( _chat ) )
				store.dispatch( operatorChatJoin( chat.id, opUser ) );
			} ) )
		)

		beforeEach( () => {
			connections = []
			return connectOperator( server.newClient(), op )
			.then( ( conn ) => {
				connections.push( conn )
				return connectOperator( server.newClient(), op )
			} )
			.then( conn => new Promise( ( resolve ) => {
				connections.push( conn )
				resolve()
			} ) )
		} )

		it( 'should not emit leave when one socket disconnects', () => {
			return new Promise( ( resolve, reject ) => {
				const [ connection ] = connections
				const { client: c, socket: s } = connection
				watchForType( OPERATOR_CHAT_LEAVE, () => {
					reject( new Error( 'there are still clients connected' ) )
				} )
				c.on( 'disconnect', () => {
					resolve()
				} )
				server.in( 'operators/user-id' ).clients( ( e, clients ) => {
					equal( clients.length, 2 )
					server.disconnect( { client: c, socket: s } )
				} )
			} )
		} )

		it.only( 'should emit chat.close to all clients in a chat', () => {
			return () => new Promise( resolve => {
				watchForType( INSERT_PENDING_CHAT, action => {
					resolve( action.chat )
				}, true )
				store.dispatch( insertPendingChat( { id: 'chat-id' } ) )
			} )
			.then( ( chat ) => connectAllClientsToChat( chat, op ) )
			.then( clients => {
				const all = Promise.all( map( clients, ( { client: opClient } ) => new Promise( resolve => {
					opClient.once( 'chat.close', ( chat, opUser ) => {
						resolve( { chat, operator: opUser, client: opClient } )
					} )
				} ) ) )
				store.dispatch( operatorChatClose( { id: 'chat-id' }, op ) )
				return all
			} )
			.then( ( messages ) => {
				equal( messages.length, 2 )
			} )
		} )
	} )

	describe( 'with multiple connected users', () => {
		let ops = [
			{ id: 'hermione', displayName: 'Hermione', avatarURL: 'url', status: 'available', capacity: 4, load: 1 },
			{ id: 'ripley', displayName: 'Ripley', avatarURL: 'url', status: 'available', capacity: 1, load: 1 },
			{ id: 'nausica', displayName: 'Nausica', avatarURL: 'url', status: 'available', capacity: 1, load: 0 },
			{ id: 'furiosa', displayName: 'Furiosa', avatarURL: 'url', status: 'available', capacity: 5, load: 0 },
			{ id: 'river', displayName: 'River Tam', status: 'available', capacity: 6, load: 3 },
			{ id: 'buffy', displayName: 'Buffy', status: 'offline', capacity: 20, load: 0 }
		]

		const assign = ( chat_id ) => new Promise( resolve => {
			watchForTypeOnce( SET_CHAT_OPERATOR, action => {
				resolve( action.operator )
			} )
			store.dispatch( insertPendingChat( { id: chat_id } ) )
		} )

		const collectPromises = ( ... promises ) => new Promise( ( resolve, reject ) => {
			let results = []
			reduce( promises, ( promise, nextPromise ) => {
				return promise.then( result => {
					if ( result !== undefined ) {
						results.push( result )
					}
					return nextPromise()
				} )
			}, Promise.resolve() )
			.then( result => {
				resolve( results.concat( [ result ] ) )
			}, reject );
		} )

		const connectAll = () => collectPromises( ... ops.map(
			op => () => new Promise( ( resolve, reject ) => {
				const io_client = server.newClient()
				const record = { load: op.load, capacity: op.capacity, status: 'available' }
				io_client.client
				.on( 'init', () => io_client.client.emit( 'status', op.status, () => {
					io_client.client.emit( 'status', record.status, () => {
						io_client.client.emit( 'capacity', record.capacity, () => {
							resolve( op )
						} )
					} )
				} ) )
				connectOperator( io_client, op ).catch( reject )
			} )
		) )

		beforeEach( () => connectAll() )

		const assignChats = ( total = 10 ) => {
			let promises = []
			for ( let i = 0; i < total; i++ ) {
				promises.push( () => assign( 'chat-' + i ) )
			}
			return collectPromises( ... promises )
		}

		// Starting loads currently can't be set so the expected calculations are off
		it.skip( 'should assign operators in correct order', () => assignChats( 9 ).then( results => {
			deepEqual(
				map( results, ( { id } ) => id ),
				[
					'furiosa',  // 0/5 => 1/5
					'nausica',  // 0/1 => 1/1
					'furiosa',  // 1/5 => 2/5
					'hermione', // 1/4 => 2/4
					'furiosa',  // 2/5 => 3/5
					'river',    // 3/6 => 4/6
					'hermione', // 2/4 => 3/4
					'furiosa',  // 3/5 => 4/5
					'river',    // 4/6 => 5/6
				]
			)
		} ) )

		it( 'should report accepting customers', () => {
			const { load, capacity } = selectTotalCapacity( store.getState(), STATUS_AVAILABLE )
			ok( load < capacity )
			equal( capacity, 17 )
		} )
	} )
} )
