import isFunction from 'lodash/isFunction'
import isEmpty from 'lodash/isEmpty'
import assign from 'lodash/assign'

import { ChatList } from './chat-list'
import { ChatLog } from './chat-log'

const debug = require( 'debug' )( 'happychat:controller' )

// change a lib/customer message to what an agent client expects
const formatAgentMessage = ( author_type, author_id, context, { id, timestamp, text, meta } ) => ( {
	id, timestamp, text,
	context,
	author_id,
	author_type,
	meta
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
	const middlewares = []
	const toAgents = forward( agents )
	const chats = new ChatList( { customers, operators } )
	const log = new ChatLog()

	const runMiddleware = ( { origin, destination, chat, user, message } ) => new Promise( middlewareComplete => {
		if ( isEmpty( middlewares ) ) {
			debug( 'no middlewares registered' )
			return middlewareComplete( message )
		}
		// copy the middleware
		const context = middlewares.slice()
		debug( 'running middleware', context.length )
		// recursively run each middleware piping the result into
		// the next middleware
		const run = ( data, [ head, ... rest ] ) => {
			if ( !head ) {
				debug( 'middleware complete', chat.id, user )
				return middlewareComplete( data.message )
			}

			// Wrapping call to middleware in Promise in case of exception
			new Promise( resolve => resolve( head( data ) ) )
			// continue running with remaining middleware
			.then( nextMessage => run( assign( {}, data, { message: nextMessage } ), rest ) )
			// if middleware fails, log the error and continue processing
			.catch( ( e ) => {
				debug( 'middleware failed to run', e )
				debug( e.stack )
				run( data, rest )
			} )
		}
		// kick off the middleware processing
		run( { origin, destination, chat, user, message }, context )
	} )

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

	customers.on( 'join', ( socketIdentifier, user, socket ) => {
		debug( 'emitting chat log' )
		log.findLog( user.id )
		.then( ( messages ) => socket.emit( 'log', messages ) )
	} )

	operators.on( 'join', ( chat, operator, socket ) => {
		debug( 'emitting chat log to operator', operator.id )
		log.findLog( chat.id )
		.then( ( messages ) => {
			socket.emit( 'log', chat, messages )
		} )
	} )

	customers.on( 'message', ( chat, message ) => {
		// broadcast the message to
		debug( 'customer message', chat.id, message.id )
		log.recordCustomerMessage( chat, message )
		.then( () => {
			const origin = 'customer'
			runMiddleware( { origin, destination: 'customer', chat, message } )
			.then( m => customers.emit( 'receive', chat, m ) )

			runMiddleware( { origin, destination: 'agent', chat, message } )
			.then( m => agents.emit( 'receive', formatAgentMessage( 'customer', chat.id, chat.id, m ) ) )

			runMiddleware( { origin, destination: 'operator', chat, message } )
			.then( m => operators.emit( 'receive', chat, m ) )
		} )
	} )

	operators.on( 'message', ( chat, operator, message ) => {
		debug( 'operator message', chat, message )
		log.recordOperatorMessage( chat, operator, message )
		.then( () => {
			const origin = 'operator'

			runMiddleware( { origin, destination: 'agent', chat, message, user: operator } )
			.then( m => agents.emit( 'receive', formatAgentMessage( 'operator', message.user.id, chat.id, m ) ) )

			runMiddleware( { origin, destination: 'operator', chat, message, user: operator } )
			.then( m => operators.emit( 'receive', chat, m ) )

			runMiddleware( { origin, destination: 'customer', chat, message, user: operator } )
			.then( m => customers.emit( 'receive', chat, m ) )
		} )
	} )

	agents.on( 'message', ( message ) => {
		const chat = { id: message.context }
		const format = ( m ) => assign( {}, { author_type: 'agent' }, m )
		log.recordAgentMessage( chat, message )
		.then( () => {
			const origin = 'agent'

			runMiddleware( { origin, destination: 'agent', chat, message } )
			.then( m => agents.emit( 'receive', assign( {}, { author_type: 'agent' }, m ) ) )

			runMiddleware( { origin, destination: 'operator', chat, message } )
			.then( m => operators.emit( 'receive', chat, format( m ) ) )

			runMiddleware( { origin, destination: 'customer', chat, message } )
			.then( m => customers.emit( 'receive', chat, format( m ) ) )
		} )
	} )

	const external = {
		middleware: ( middleware ) => {
			if ( middleware.length >= 2 ) {
				middlewares.push( ( ... args ) => new Promise( resolve => middleware( ... args.concat( resolve ) ) ) )
			} else {
				middlewares.push( middleware )
			}
			return external
		},
		middlewares
	}

	return external
}

