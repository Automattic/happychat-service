import chatStatusNotifier from 'state/middlewares/system/chat-status-notifier';
import reducer from 'state/reducer';
import { deepEqual } from 'assert';
import { STATUS_MISSED, STATUS_ASSIGNED, STATUS_NEW } from 'state/chatlist/reducer';
import { state, assignedChatID, newChatID, newChat, onlineOperator } from '../../mock-state';

import {
	setChatMissed,
	notifyChatStatusChanged,
	setChatOperator
} from 'state/chatlist/actions';

/**
 * @callback { Function } DispatchResolver
 * @param { Object } action - action to be dispatched
 * @param { Object } currentState - state of the redux store
 * @returns { Promise } resolves the next dispatched action
 */

/**
 * Utility function to exercise a middleware asyncronously.
 *
 * @param { Function } middleware - redux middleware to use in dispatches
 * @returns { DispatchResolver } function that takes an action and initial state
 */
const dispatchWithMiddleware = ( middleware ) => {
	return ( action, currentState = reducer( undefined, { type: null } ) ) => {
		const next = _action => {
			currentState = reducer( currentState, _action );
			return _action;
		};
		return new Promise( resolve => {
			const run = middleware( { getState: () => currentState, dispatch: resolve } );
			run( next )( action );
		} );
	};
};

const dispatchResolveNextAction = dispatchWithMiddleware( chatStatusNotifier );

const assertDispatches = ( action, expectedAction, initialState = state ) =>
	dispatchResolveNextAction( action, initialState ).then( nextAction => {
		deepEqual( nextAction, expectedAction );
	} );

describe( 'state/middleware/system/chat-status-notifier', () => {
	it( 'handles setChatMissed', () => assertDispatches(
		setChatMissed( assignedChatID ),
		notifyChatStatusChanged( assignedChatID, STATUS_MISSED, STATUS_ASSIGNED )
	) );

	it( 'handles setChatOperator', () => assertDispatches(
		setChatOperator( newChatID, onlineOperator ),
		notifyChatStatusChanged( newChatID, STATUS_ASSIGNED, STATUS_NEW )
	) );

	it( 'handles setChatCustomerDisconnect' );
	it( 'handles insertPendingChat' );
	it( 'handles assignChat' );
	it( 'handles setChatsRecovered' );
	it( 'handles setOperatorChatsAbandoned' );
	it( 'handles closeChat' );
	it( 'handles autocloseChat' );
} );
