import makeService, { authenticators } from './helpers';
import { equal, ok } from 'assert';

import {
OPERATOR_CHAT_TRANSCRIPT_REQUEST
} from 'state/action-types';

const debug = require( 'debug' )( 'happychat:test:integration' );

describe( 'Operator transcript request', () => {
	const operator = { id: 'operator', username: 'ripley', displayName: 'Ripley', picture: '' };
	const service = makeService(
		authenticators( null, operator, null ),
		undefined,
		[ () => next => action => {
			switch ( action.type ) {
				case OPERATOR_CHAT_TRANSCRIPT_REQUEST:
					if ( action.chat_id === 'chat-id' ) {
						return Promise.resolve( { timestamp: action.timestamp, messages: [
							{ id: 'message-1', timestamp: action.timestamp - 1 },
							{ id: 'message-2', timestamp: action.timestamp - 2 }
						] } );
					}
					return Promise.reject( new Error( 'not available' ) );
			}
			return next( action );
		} ],
		{ chatlist: { 'chat-id': [ 'closed', { id: 'chat-id' } ] } }
	);

	before( () => {
		debug( 'starting service' );
		service.start();
	} );

	after( () => {
		debug( 'stopping service' );
		service.stop();
	} );

	const startClient = () => service.startOperator().then( client => new Promise( resolve => {
		client.once( 'connect', () => {
			client.once( 'auth', auth => auth( null, operator ) );
			client.once( 'init', () => resolve( client ) );
			debug( 'connected' );
		} );
	} ) );

	it( 'should provide transcript history to an operator', () => startClient()
		.then( client => new Promise( ( resolve, reject ) => {
			debug( 'wait for the transcript' );
			client.emit( 'chat.transcript', 'chat-id', 1000, ( error, transcript ) => {
				if ( error ) {
					return reject( new Error( error ) );
				}
				equal( transcript.timestamp, 1000 );
				ok( transcript.messages );
				resolve();
			} );
		} ) )
	);

	it( 'should receive transcript failure response', () => startClient()
		.then( client => new Promise( ( resolve, reject ) => {
			client.emit( 'chat.transcript', 'missing-id', 1000, ( error ) => {
				if ( ! error ) {
					return reject( new Error( 'there was no error' ) );
				}
				resolve();
			} );
		} ) )
	);
} );
