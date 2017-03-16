import { map, filter } from 'ramda'

import { run } from '../../../middleware-interface'
import {
	OPERATOR_CHAT_TRANSCRIPT_RESPONSE,
	CUSTOMER_CHAT_TRANSCRIPT_RESPONSE
} from '../../action-types';
import {
	sendCustomerChatTranscriptResponse,
	customerChatTranscriptFailure
} from '../../chatlist/actions'
import {
	sendOperatorChatTranscriptResponse,
	operatorChatTranscriptFailure
} from '../../operator/actions'
import {
	getChat
} from '../../chatlist/selectors'

import { beforeNextAction, handleActionType, handlers } from './handlers'

const debug = require( 'debug' )( 'happychat-debug:transcript-requester' )

const handleOperatorResponse = ( store, messageFilter ) => action => {
	debug( 'chat.transcript for operator', action.chat_id, action.timestamp )
	// debug time to run each message through middleware
	const dispatch = deferred => setImmediate( () => store.dispatch( deferred ) )

	new Promise( ( resolve, reject ) => {
		const chat = getChat( action.chat_id, store.getState() )
		if ( ! chat ) {
			return reject( new Error( 'chat not found' ) )
		}
		messageFilter( chat, action.messages ).then( resolve, reject )
	} )
	.then(
		messages => dispatch( sendOperatorChatTranscriptResponse( action.socketId, action.chat_id, action.timestamp, messages ) ),
		error => dispatch( operatorChatTranscriptFailure( action.socketId, action.chat_id, error.message ) )
	)
}

const handleCustomerResponse = ( store, messageFilter ) => action => {
	debug( 'transcript for customer', action.chat_id, action.timestamp )
	// debug time to run each message through middleware
	const dispatch = deferred => setImmediate( () => store.dispatch( deferred ) )

	new Promise( ( resolve, reject ) => {
		const chat = getChat( action.chat_id, store.getState() )
		if ( ! chat ) {
			return reject( new Error( 'chat not found' ) )
		}
		messageFilter( chat, action.messages ).then( resolve, reject )
	} )
	.then(
		messages => dispatch( sendCustomerChatTranscriptResponse( action.socketId, action.chat_id, action.timestamp, messages ) ),
		error => dispatch( customerChatTranscriptFailure( action.socketId, action.chat_id, error.message ) )
	)
}

export default messageMiddlewares => {
	const messageFilter = ( ... args ) => run( messageMiddlewares )( ... args )
	const filterMessagesFor = destination => ( chat, messages ) => Promise.all( map( message => messageFilter( {
		origin: message.source,
		destination,
		user: message.user,
		message,
		chat
	} ), messages ) )
	.then( filter( message => !! message ) )

	return store => beforeNextAction( handlers(
		handleActionType( OPERATOR_CHAT_TRANSCRIPT_RESPONSE, handleOperatorResponse( store, filterMessagesFor( 'operator' ) ) ),
		handleActionType( CUSTOMER_CHAT_TRANSCRIPT_RESPONSE, handleCustomerResponse( store, filterMessagesFor( 'customer' ) ) ),
	) )
}
