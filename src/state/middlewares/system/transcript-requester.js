import { map, filter } from 'ramda';

import { run } from '../../../middleware-interface';
import {
	OPERATOR_CHAT_TRANSCRIPT_RESPONSE,
	CUSTOMER_CHAT_TRANSCRIPT_RESPONSE
} from '../../action-types';
import {
	sendCustomerChatTranscriptResponse,
	customerChatTranscriptFailure
} from '../../chatlist/actions';
import {
	sendOperatorChatTranscriptResponse,
	operatorChatTranscriptFailure
} from '../../operator/actions';
import {
	getChat
} from '../../chatlist/selectors';

const debug = require( 'debug' )( 'happychat-debug:transcript-requester' );

export default messageFilters => store => {
	const messageFilter = ( ... args ) => run( messageFilters )( ... args );
	const filterMessagesFor = destination => ( chat, messages ) =>
		Promise.all( map( message => messageFilter( {
			origin: message.source,
			destination,
			user: message.user,
			message,
			chat
		} ), messages ) )
		.then(
			filter( message => !! message ),
			e => debug( 'wtf', e )
		);

	const handleOperatorResponse = action => {
		debug( 'chat.transcript for operator', action.chat_id, action.timestamp );
		// debug time to run each message through middleware
		const dispatch = deferred => setImmediate( () => store.dispatch( deferred ) );

		new Promise( ( resolve, reject ) => {
			const chat = getChat( action.chat_id, store.getState() );
			if ( ! chat ) {
				return reject( new Error( 'chat not found' ) );
			}
			filterMessagesFor( 'operator' )( chat, action.messages ).then( resolve, reject );
		} )
		.then(
			messages => dispatch( sendOperatorChatTranscriptResponse(
				action.socketId, action.chat_id, action.timestamp, messages
			) ),
			error => dispatch( operatorChatTranscriptFailure(
				action.socketId, action.chat_id, error.message
			) )
		);
	};

	const handleCustomerResponse = action => {
		debug( 'transcript for customer', action.chat_id, action.timestamp );
		// debug time to run each message through middleware
		const dispatch = deferred => setImmediate( () => store.dispatch( deferred ) );

		new Promise( ( resolve, reject ) => {
			const chat = getChat( action.chat_id, store.getState() );
			if ( ! chat ) {
				return reject( new Error( 'chat not found' ) );
			}
			filterMessagesFor( 'customer' )( chat, action.messages ).then( resolve, reject );
		} )
		.then(
			messages => {
				debug( 'dispatching success' );
				dispatch( sendCustomerChatTranscriptResponse(
					action.socketId, action.chat_id, action.timestamp, messages
				) );
			},
			error => {
				debug( 'dispatching failure', error );
				dispatch( customerChatTranscriptFailure(
					action.socketId, action.chat_id, error.message
				) );
			}
		);
	};

	return next => action => {
		switch ( action.type ) {
			case OPERATOR_CHAT_TRANSCRIPT_RESPONSE:
				handleOperatorResponse( action );
				break;
			case CUSTOMER_CHAT_TRANSCRIPT_RESPONSE:
				handleCustomerResponse( action );
				break;
		}
		return next( action );
	};
};
