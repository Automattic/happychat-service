import { equal } from 'assert';
import customer from 'state/middlewares/socket-io/customer';
import { run } from 'message-filter';
import { EventEmitter } from 'events';

import { notifyChatStatusChanged } from 'state/chatlist/actions';
import { getChatStatus } from 'state/chatlist/selectors';
import { state, newChatID } from '../../mock-state';

/**
 * Mock customer auth interface
 * @param { Object } socket - socket.io client connection
 * @returns { Promise } resolves customer identity for the connecting socket
 */
const auth = () => new Promise( resolve => {
	resolve();
} );

const messageFilter = ( ... args ) => run( [] )( ... args );
const noop = () => {};

describe( 'state/middlewares/socket-io/customer', () => {
	/**
	 * Ensures that Socket.IO clients rececive a 'status' event for a customer's
	 * chat room when `notifyChatStatusChanged` is emitted.
	 */
	it( 'handles NOTIFY_CHAT_STATUS_CHANGED', done => {
		// sets up a mock Socket.IO server interface
		const io = new EventEmitter();
		// the customer's chat room will receive an event so all potentially connected clients
		// are set to the same status
		io.to = room => {
			equal( room, `customer/${ newChatID }` );
			// mock Socket.IO room interface
			return {
				emit: ( event, status ) => {
					equal( event, 'status' );
					equal( status, getChatStatus( newChatID, state ) );
					done();
				}
			};
		};
		const middleware = customer( { io }, auth, messageFilter )( { getState: () => state } );
		middleware( noop )( notifyChatStatusChanged( newChatID ) );
	} );
} );
