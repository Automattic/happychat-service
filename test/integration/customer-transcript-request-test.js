import makeService, { authenticators } from './helpers';
import { equal, ok } from 'assert';

import {
	CUSTOMER_CHAT_TRANSCRIPT_REQUEST
} from 'state/action-types';

const debug = require( 'debug' )( 'happychat:test:integration' );

describe( 'Customer transcript request', () => {
	const customer = { id: 'operator', username: 'ripley', displayName: 'Ripley', picture: '', session_id: 'session-id' };
	const service = makeService(
		authenticators( customer, null, null ),
		undefined,
		[ ( { dispatch } ) => next => action => {
			switch ( action.type ) {
				case CUSTOMER_CHAT_TRANSCRIPT_REQUEST:
					debug( 'transcript requested', action );
					if ( action.chat_id === 'session-id' && action.timestamp > 0 ) {
						return Promise.resolve( { timestamp: action.timestamp, messages: [
							{ id: 'message-1', timestamp: action.timestamp - 1 },
							{ id: 'message-2', timestamp: action.timestamp - 2 }
						] } );
					}
					return Promise.reject( new Error( 'transcript failed' ) );

					break;
			}
			return next( action );
		} ],
		{ chatlist: { 'chat-id': [ 'closed', { id: 'chat-id' } ] } },
		[ () => false ]
	);

	before( () => {
		debug( 'starting service' );
		service.start();
	} );

	after( () => {
		debug( 'stopping service' );
		service.stop();
	} );

	const startClient = () => service.startCustomer().then( client => new Promise( resolve => {
		client.once( 'connect', () => {
			client.once( 'auth', auth => auth( null, customer ) );
			client.once( 'init', () => resolve( client ) );
			debug( 'connected' );
		} );
	} ) );

	it( 'should provide transcript history a customer', () => startClient()
		.then( client => new Promise( ( resolve, reject ) => {
			debug( 'wait for the transcript' );
			client.emit( 'transcript', 1000, ( error, transcript ) => {
				if ( error ) {
					return reject( error );
				}
				equal( transcript.timestamp, 1000 );
				ok( transcript.messages );
				resolve();
			} );
		} ) )
	);

	it( 'should receive transcript failure response', () => startClient()
		.then( client => new Promise( resolve => {
			client.emit( 'transcript', -1, ( error ) => {
				if ( ! error ) {
					return reject( new Error( 'no error' ) );
				}
				resolve();
			} );
		} ) )
	);
} );
