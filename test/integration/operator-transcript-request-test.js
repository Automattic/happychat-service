import makeService, { authenticators } from './helpers'
import { equal, ok } from 'assert'

import {
OPERATOR_CHAT_TRANSCRIPT_REQUEST
} from 'state/action-types'

import {
	operatorChatTranscriptResponse,
	operatorChatTranscriptFailure
} from 'state/operator/actions'

const debug = require( 'debug' )( 'happychat:test:integration' )

describe( 'Operator transcript request', () => {
	const operator = { id: 'operator', username: 'ripley', displayName: 'Ripley', picture: '' }
	const service = makeService(
		authenticators( null, operator, null ),
		undefined,
		[ ( { dispatch } ) => next => action => {
			switch ( action.type ) {
				case OPERATOR_CHAT_TRANSCRIPT_REQUEST:
					if ( action.chat_id === 'chat-id' ) {
						setImmediate( () => {
							dispatch( operatorChatTranscriptResponse( action.socketId, action.chat_id, action.timestamp, [
								{ id: 'message-1', timestamp: action.timestamp - 1 },
								{ id: 'message-2', timestamp: action.timestamp - 2 }
							] ) )
						} )
					} else {
						setImmediate( () => {
							dispatch( operatorChatTranscriptFailure( action.socketId, action.chat_id, 'error' ) )
						} )
					}
					break
			}
			return next( action )
		} ],
		{ chatlist: { 'chat-id': [ 'closed', { id: 'chat-id' } ] } }
	)

	before( () => {
		debug( 'starting service' )
		service.start()
	} )

	after( () => {
		debug( 'stopping service' )
		service.stop()
	} )

	const startClient = () => service.startOperator().then( client => new Promise( resolve => {
		client.once( 'connect', () => {
			client.once( 'auth', auth => auth( null, operator ) )
			client.once( 'init', () => resolve( client ) )
			debug( 'connected' )
		} )
	} ) )

	it( 'should provide transcript history to an operator', () => startClient()
		.then( client => new Promise( ( resolve, reject ) => {
			debug( 'wait for the transcript' )
			client.once( 'chat.transcript', ( chat, transcript ) => {
				equal( chat.id, 'chat-id' )
				equal( transcript.timestamp, 1000 )
				ok( transcript.messages )
				resolve()
			} )
			client.once( 'chat.transcript.failure', ( chat_id, errorMessage ) => {
				reject( new Error( errorMessage ) )
			} )
			client.emit( 'chat.transcript', 'chat-id', 1000 )
		} ) )
	)

	it( 'should receive transcript failure response', () => startClient()
		.then( client => new Promise( resolve => {
			client.once( 'chat.transcript.failure', resolve )
			client.emit( 'chat.transcript', 'missing-id', 1000 )
		} ) )
	)
} )
