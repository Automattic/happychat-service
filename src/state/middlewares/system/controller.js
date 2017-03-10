import { assoc, dissoc, compose, slice, append, defaultTo, prop, merge, pipe, when, path, not, isNil } from 'ramda'
import { run } from '../../../middleware-interface'

import {
	OPERATOR_TYPING,
	AGENT_INBOUND_MESSAGE,
	CUSTOMER_INBOUND_MESSAGE,
	OPERATOR_INBOUND_MESSAGE,
	CUSTOMER_TYPING,
	CUSTOMER_JOIN,
	OPERATOR_JOIN,
	REMOVE_CHAT,
	CLOSE_CHAT
} from '../../action-types'
import { operatorReceiveTyping } from '../../operator/actions'
import {
	agentReceiveMessage,
	customerReceiveMessage,
	customerReceiveTyping,
	operatorReceiveMessage,
	receiveMessage,
} from '../../chatlist/actions'
import { operatorRoom } from '../socket-io/operator'
import { customerRoom } from '../socket-io/chatlist'

const debug = require( 'debug' )( 'happychat-debug:controller' )

const DEFAULT_MAX_MESSAGES = 100

export class ChatLog {

	constructor( options = { maxMessages: DEFAULT_MAX_MESSAGES } ) {
		this.maxMessages = options.maxMessages
		this.chats = {}
	}

	append( id, message ) {
		this.chats = assoc( id, compose(
			slice( - this.maxMessages, Infinity ),
			append( message )
		)( this.findLog( id ) ), this.chats )
	}

	findLog( id ) {
		return defaultTo( [], prop( id, this.chats ) )
	}

	evict( id ) {
		this.chats = dissoc( id, this.chats )
	}

	recordMessage( chat, message ) {
		return this.append( chat.id, message )
	}
}

// change a lib/customer message to what an agent client expects
const formatAgentMessage = ( author_type, author_id, session_id, { id, timestamp, text, meta, type, source } ) => ( {
	id, timestamp, text,
	session_id,
	author_id,
	author_type,
	type,
	meta,
	source
} )

export default ( middlewares, { customers, operators } ) => store => {
	const cache = { operator: new ChatLog( { maxMessages: 20 } ), customer: new ChatLog( { maxMessages: 20 } ) }

	const runMiddleware = ( ... args ) => run( middlewares )( ... args )

	// toAgents( customers, 'disconnect', 'customer.disconnect' ) // TODO: do we want to wait till timer triggers?
	const handleCustomerJoin = action => {
		const { chat } = action
		customers.in( customerRoom( chat.id ) ).emit( 'log', cache.customer.findLog( chat.id ) )
	}

	const handleOperatorJoin = action => {
		const { chat, user } = action
		debug( 'sending logs to operator room', user.id )
		operators
		.in( operatorRoom( user.id ) )
		.emit( 'log', chat, cache.operator.findLog( chat.id ) )
	}

	const handleCustomerTyping = action => {
		const { id, user, text } = action
		store.dispatch( operatorReceiveTyping( id, user, text ) );
	}

	const handleOperatorTyping = action => {
		const { id, user, text } = action
		store.dispatch( operatorReceiveTyping( id, user, text ) );
		store.dispatch( customerReceiveTyping( id, user, text ) )
	}

	const handleCustomerInboundMessage = ( action ) => {
		const { chat, message, user } = action
		// broadcast the message to
		const customerMessage = assoc( 'source', 'customer', message );
		store.dispatch( receiveMessage( 'customer', chat, customerMessage, user ) )

		const origin = 'customer'
		runMiddleware( { origin, destination: 'customer', chat, message: customerMessage } )
		.then( m => {
			cache.customer.recordMessage( chat, m )
			store.dispatch( customerReceiveMessage( chat.id, m ) )
			return m
		}, e => debug( 'middleware failed ', e.message ) )

		runMiddleware( { origin, destination: 'agent', chat, message: customerMessage } )
		.then( m => store.dispatch(
			agentReceiveMessage( formatAgentMessage( 'customer', chat.id, chat.id, m ) )
		), e => debug( 'middleware failed', e.message ) )

		runMiddleware( { origin, destination: 'operator', chat, message: customerMessage } )
		.then( m => {
			cache.operator.recordMessage( chat, m )
			store.dispatch( operatorReceiveMessage( chat.id, m ) )
			return m
		}, e => debug( 'middleware failed', e.message ) )
	}

	const handleOperatorInboundMessage = action => {
		const { chat_id, user: operator, message } = action
		const operatorMessage = assoc( 'source', 'operator', message )
		const chat = { id: chat_id }
		debug( 'operator message', chat.id, message.id )
		const origin = 'operator'

		store.dispatch( receiveMessage( 'operator', chat, operatorMessage, operator ) )

		runMiddleware( { origin, destination: 'agent', chat, message: operatorMessage, user: operator } )
		.then( m => store.dispatch(
			agentReceiveMessage( formatAgentMessage( 'operator', operator.id, chat.id, m ) )
		) )

		runMiddleware( { origin, destination: 'operator', chat, message: operatorMessage, user: operator } )
		.then( m => {
			cache.operator.recordMessage( chat, m )
			store.dispatch( operatorReceiveMessage( chat.id, m ) )
			return m
		} )

		runMiddleware( { origin, destination: 'customer', chat, message: operatorMessage, user: operator } )
		.then( m => {
			cache.customer.recordMessage( chat, operator, m )
			store.dispatch( customerReceiveMessage( chat.id, m ) )
			return m
		} )
	}

	const handleAgentInboundMessage = action => {
		const { message, agent } = action
		const chat = { id: message.session_id }
		const format = ( m ) => merge( { author_type: 'agent' }, m )
		const agentMessage = assoc( 'source', 'agent', message )
		const origin = 'agent'

		store.dispatch( receiveMessage( 'agent', chat, agentMessage, agent ) )

		runMiddleware( { origin, destination: 'agent', chat, message: agentMessage } )
		.then( m => store.dispatch(
			agentReceiveMessage( merge( { author_type: 'agent' }, m ) )
		) )

		runMiddleware( { origin, destination: 'operator', chat, message: agentMessage } )
		.then( m => {
			cache.operator.recordMessage( chat, m )
			store.dispatch( operatorReceiveMessage( chat.id, format( m ) ) )
			return m
		} )

		runMiddleware( { origin, destination: 'customer', chat, message: agentMessage } )
		.then( m => {
			cache.customer.recordMessage( chat, message )
			store.dispatch(
				customerReceiveMessage( chat.id, format( m ) )
			)
			return m
		} )
	}

	const evictChat = idPath => pipe(
		when( pipe( not, isNil ), id => {
			cache.operator.evict( id )
			cache.customer.evict( id )
		} ),
		path( idPath )
	)

	const handleCloseChat = evictChat( [ 'chat', 'id' ] )

	const handleRemoveChat = evictChat( [ 'id' ] )

	return next => action => {
		switch ( action.type ) {
			case AGENT_INBOUND_MESSAGE:
				handleAgentInboundMessage( action )
				break;
			case OPERATOR_INBOUND_MESSAGE:
				handleOperatorInboundMessage( action )
				break;
			case CUSTOMER_INBOUND_MESSAGE:
				handleCustomerInboundMessage( action )
				break;
			case OPERATOR_TYPING:
				handleOperatorTyping( action )
				break;
			case CUSTOMER_TYPING:
				handleCustomerTyping( action )
				break;
			case CUSTOMER_JOIN:
				handleCustomerJoin( action )
				break;
			case OPERATOR_JOIN:
				handleOperatorJoin( action )
				break;
			case CLOSE_CHAT:
				handleCloseChat( action )
				break;
			case REMOVE_CHAT:
				handleRemoveChat( action )
				break;
		}
		return next( action )
	}
}

