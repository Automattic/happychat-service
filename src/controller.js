import { isFunction } from 'lodash/lang'

import { ChatList } from './chat-list'

const debug = require( 'debug' )( 'tinkerchat:controller' )

// change a lib/customer message to what an agent client expects
const formatAgentMessage = ( author_type, author_id, context, { id, timestamp, text } ) => ( {
	id, timestamp, text,
	context,
	author_id,
	author_type
} )

const pure = ( ... args ) => args

const forward = ( dest ) => ( org, event, dstEvent, mapArgs = pure ) => {
	if ( isFunction( dstEvent ) ) {
		mapArgs = dstEvent
		dstEvent = event
	}
	if ( !dstEvent ) {
		dstEvent = event
	}
	org.on( event, ( ... args ) => dest.emit( dstEvent, ... mapArgs( ... args ) ) )
}

const on = ( emitter, event, listener ) => emitter.on( event, listener )

export default ( { customers, agents, operators } ) => {
	const toAgents = forward( agents )
	const chats = new ChatList( { customers, operators } )

	chats
	.on( 'miss', ( e, { id } ) => {
		debug( 'failed to find operator', e, id )
	} )
	.on( 'open', ( { id } ) => {
		debug( 'looking for operator', id )
	} )
	.on( 'found', ( channel, operator ) => {
		debug( 'found operator', channel.id, operator.id )
	} )

	// forward customer join and leave events to agents
	toAgents( customers, 'message', 'receive', ( { id }, message ) => {
		return [ formatAgentMessage( 'customer', id, id, message ) ]
	} )
	toAgents( customers, 'join', 'customer.join' )
	toAgents( customers, 'leave', 'customer.leave' )

	on( agents, 'message', ( message ) => {
		customers.emit( 'receive', Object.assign( {}, { author_type: 'agent' }, message ) )
	} )
}

