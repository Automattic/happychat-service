import { isFunction } from 'lodash/lang'
import { assign } from 'lodash/object'

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

export default ( { customers, agents, operators } ) => {
	const toAgents = forward( agents )
	const chats = new ChatList( { customers, operators } )

	chats
	.on( 'miss', ( e, { id } ) => {
		debug( 'failed to find operator', e, id, e.stack )
	} )
	.on( 'open', ( { id } ) => {
		debug( 'looking for operator', id )
	} )
	.on( 'found', ( channel, operator ) => {
		debug( 'found operator', channel.id, operator.id )
	} )
	.on( 'chat.status', ( status, chat ) => {
		debug( 'chats status changed', status, chat.id )
	} )

	toAgents( customers, 'join', 'customer.join' )
	toAgents( customers, 'leave', 'customer.leave' )

	customers.on( 'message', ( chat, message ) => {
		// broadcast the message to
		// - agents
		agents.emit( 'receive', formatAgentMessage( 'customer', chat.id, chat.id, message ) )
		// - customers
		customers.emit( 'receive', chat, message )
		// - operators
		operators.emit( 'receive', chat, message )
	} )

	operators.on( 'message', ( chat, user, message ) => {
		debug( 'operator message', chat, message )
		agents.emit( 'receive', formatAgentMessage( 'operator', message.user.id, chat.id, message ) )
		operators.emit( 'receive', chat, message )
		customers.emit( 'receive', chat, message )
		// - customers
	} )

	agents.on( 'message', ( message ) => {
		// broadcast the message to
		// - agents
		agents.emit( 'receive', assign( {}, { author_type: 'agent' }, message ) )
		// - operators
		operators.emit( 'receive', { id: message.context }, assign( {}, { author_type: 'agent' }, message ) )
		// - customers
		customers.emit( 'receive', { id: message.context }, assign( {}, { author_type: 'agent' }, message ) )
	} )
}

