import { always } from 'ramda'
import { deepEqual } from 'assert'

import middleware from 'state/middlewares/system/transcript-requester'
import {
	customerChatTranscriptResponse,
	customerChatTranscriptFailure,
	sendCustomerChatTranscriptResponse,
} from 'state/chatlist/actions'
import {
	operatorChatTranscriptResponse,
	operatorChatTranscriptFailure,
	sendOperatorChatTranscriptResponse
} from 'state/operator/actions'

const TIMESTAMP = new Date( 0 ).getTime()
const noop = value => value

const DEFAULT_STATE = { chatlist: { 'chat-id': [ 'mock-status', {} ] } }

describe( 'Transcript requester', () => {
	const expectDispatch = ( dispatchAction, expectedAction, state = DEFAULT_STATE ) => new Promise( ( resolve ) => {
		const store = {
			dispatch: action => {
				deepEqual( action, expectedAction )
				resolve()
			},
			getState: always( state )
		}
		// run the middleware with
		// - mock message middlewares
		// - mock store
		// - next handler that does nothing
		// - the action to dispatch on the middleware
		middleware( [ ( { message, destination } ) => {
			if ( destination === 'operator' && message.skipForOperator === true ) return false
			if ( destination === 'customer' && message.skipForCustomer === true ) return false
			return message
		} ] )( store )( noop )( dispatchAction )
	} )

	it( 'should send operator transcript response', () => expectDispatch(
		operatorChatTranscriptResponse( 'socket', 'chat-id', TIMESTAMP, [ { id: 'mock' } ] ),
		sendOperatorChatTranscriptResponse( 'socket', 'chat-id', TIMESTAMP, [ {
			id: 'mock'
		} ] )
	) )

	it( 'should handle operator requesting missing chat', () => expectDispatch(
		operatorChatTranscriptResponse( 'socket', 'missing-chat', TIMESTAMP, [ { id: 'mock' } ] ),
		operatorChatTranscriptFailure( 'socket', 'missing-chat', 'chat not found' )
	) )

	it( 'should pass operator destined messages through middleware', () => expectDispatch(
		operatorChatTranscriptResponse( 'socket', 'chat-id', TIMESTAMP, [ { id: 'skip', skipForOperator: true }, { id: 'mock' } ] ),
		sendOperatorChatTranscriptResponse( 'socket', 'chat-id', TIMESTAMP, [ { id: 'mock' } ] )
	) )

	it( 'should send customer transcript response', () => expectDispatch(
		customerChatTranscriptResponse( 'socket', 'chat-id', TIMESTAMP, [ { id: 'mock' } ] ),
		sendCustomerChatTranscriptResponse( 'socket', 'chat-id', TIMESTAMP, [ {
			id: 'mock'
		} ] )
	) )

	it( 'should handle customer requesting missing chat', () => expectDispatch(
		customerChatTranscriptResponse( 'socket', 'missing-chat', TIMESTAMP, [ { id: 'mock' } ] ),
		customerChatTranscriptFailure( 'socket', 'missing-chat', 'chat not found' )
	) )

	it( 'should pass customer destined messages through middleware', () => expectDispatch(
		customerChatTranscriptResponse( 'socket', 'chat-id', TIMESTAMP, [ { id: 'skip', skipForCustomer: true }, { id: 'mock' } ] ),
		sendCustomerChatTranscriptResponse( 'socket', 'chat-id', TIMESTAMP, [ { id: 'mock' } ] )
	) )
} )
