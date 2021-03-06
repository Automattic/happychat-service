import { createStore, applyMiddleware, compose } from 'redux';
import { equal } from 'assert';
import { EventEmitter } from 'events';
import assign from 'lodash/assign';
import enhancer from 'state';
import { reducer } from 'service';
import mockio from '../mock-io';
import WatchingMiddleware from '../mock-middleware';
import {
	AGENT_RECEIVE_MESSAGE,
	OPERATOR_RECEIVE_MESSAGE,
	CUSTOMER_RECEIVE_MESSAGE
} from 'state/action-types';
import {
	agentInboundMessage,
	customerInboundMessage,
	operatorInboundMessage,
} from 'state/chatlist/actions';

describe( 'Controller filter', () => {
	let customers, agents, operators, watchingMiddleware, chats;
	let store;

	const watchForType = ( ... args ) => watchingMiddleware.watchForType( ... args );

	beforeEach( () => {
		customers = new EventEmitter();
		agents = new EventEmitter();
		operators = new EventEmitter();
		chats = new EventEmitter();
		watchingMiddleware = new WatchingMiddleware();
	} );

	const run = filters => {
		store = createStore( reducer, compose(
			enhancer( {
				io: mockio().server,
				customers,
				operators,
				agents,
				chatlist: chats,
				messageFilters: filters,
			} ),
			applyMiddleware( watchingMiddleware.middleware() )
		) );
	};

	it( 'should pass customer message through middleware', ( done ) => {
		watchForType( CUSTOMER_RECEIVE_MESSAGE, action => {
			const { message } = action;
			equal( message.text, 'middleware intercepted' );
			done();
		} );
		run( [ ( { origin, destination, message } ) => {
			equal( origin, 'customer' );
			equal( destination, 'customer' );
			equal( message.text, 'hello' );
			return assign( {}, message, { text: 'middleware intercepted' } );
		} ] );
		store.dispatch( customerInboundMessage(
			{ id: 'user-id' },
			{ context: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 }
		) );
	} );

	it( 'should pass customer message to operator', done => {
		run( [ ( { origin, destination } ) => {
			if ( origin === 'customer' && destination === 'operator' ) {
				done();
			}
		} ] );
		store.dispatch( customerInboundMessage(
			{ id: 'user-id' },
			{ context: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 }
		) );
	} );

	it( 'should support promise based middleware', ( done ) => {
		watchingMiddleware.watchForType( AGENT_RECEIVE_MESSAGE, ( action ) => {
			const { message } = action;
			equal( message.text, 'hello world' );
			done();
		} );

		run( [ ( { origin, destination, message } ) => new Promise( ( resolve ) => {
			equal( origin, 'agent' );
			equal( destination, 'agent' );
			resolve( assign( {}, message, { text: 'hello world' } ) );
		} ) ] );

		store.dispatch( agentInboundMessage( 'agent',
			{ id: 'message-id', context: 'chat-id', timestamp: 12345, author_id: 'author' }
		) );
	} );

	it( 'should support callback based middleware', ( done ) => {
		watchingMiddleware.watchForType( OPERATOR_RECEIVE_MESSAGE, ( action ) => {
			equal( action.message.text, 'intercepted' );
			done();
		} );

		run( [ ( { origin, destination, message }, next ) => {
			equal( origin, 'operator' );
			equal( destination, 'operator' );
			next( assign( {}, message, { text: 'intercepted' } ) );
		} ] );

		store.dispatch( operatorInboundMessage(
			'chat-id',
			{ id: 'op-id' },
			{ id: 'message-id', user: { id: 'op-id' }, timestamp: 12345 }
		) );
	} );

	it( 'should still succeed when middlewares fail', ( done ) => {
		watchingMiddleware.watchForType( OPERATOR_RECEIVE_MESSAGE, ( action ) => {
			equal( action.message.text, 'goodbye world' );
			done();
		} );

		run( [
			( { message } ) => new Promise( ( resolve ) => {
				resolve( assign( {}, message, { text: 'goodbye' } ) );
			} ),
			() => {
				throw new Error( 'failed to work' );
			},
			( { message } ) => assign( {}, message, { text: message.text + ' world' } )
		] );

		store.dispatch( customerInboundMessage(
			{ id: 'user-id' },
			{ context: 'user-id', id: 'message-id', text: 'hello', timestamp: 12345 }
		) );
	} );

	it( 'should prevent message from sending by returning falsey message', ( done ) => {
		const failOnEmit = ( ... args ) => {
			done( new Error( 'message emitted: ' + JSON.stringify( args, null, '\t' ) ) );
		};

		// if any of the namespaces send the message, fail the test
		customers.on( 'receive', failOnEmit );
		operators.on( 'receive', failOnEmit );
		agents.on( 'receive', failOnEmit );

		// kind of hacky, the end result is that nothing happens due to the middleware preventing the message from being sent
		setTimeout( done, 100 );

		run( [ () => false ] );
		store.dispatch( customerInboundMessage(
			{ id: 'user-id' },
			{ context: 'user-id', id: 'message-id', text: 'hello', timestamp: 1 }
		) );
	} );
} );
