import isFunction from 'lodash/isFunction'
import isEmpty from 'lodash/isEmpty'
import assign from 'lodash/assign'

import { ChatList } from './chat-list'
import { ChatLog } from './chat-log'
import { makeEventMessage } from './util'

const debug = require( 'debug' )( 'happychat:controller' )

// change a lib/customer message to what an agent client expects
const formatAgentMessage = ( author_type, author_id, session_id, { id, timestamp, text, meta, type } ) => ( {
	id, timestamp, text,
	session_id,
	author_id,
	author_type,
	type,
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

export const NO_OPS_AVAILABLE_MSG = 'No agents are currently available to chat, please try again later.';

export default ( { customers, agents, operators } ) => {
	const middlewares = []
	const toAgents = forward( agents )
	const chats = new ChatList( { customers, operators } )
	const log = { operator: new ChatLog(), customer: new ChatLog() }

	const runMiddleware = ( { origin, destination, chat, user, message } ) => new Promise( ( resolveMiddleware ) => {
		new Promise( middlewareComplete => {
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
					debug( 'middleware complete', chat.id, data )
					return middlewareComplete( data.message )
				}

				// Wrapping call to middleware in Promise in case of exception
				new Promise( resolve => resolve( head( data ) ) )
				// continue running with remaining middleware
				.then( nextMessage => run( assign( {}, data, { message: nextMessage } ), rest ) )
				// if middleware fails, log the error and continue processing
				.catch( e => {
					debug( 'middleware failed to run', e )
					debug( e.stack )
					run( data, rest )
				} )
			}
			// kick off the middleware processing
			run( { origin, destination, chat, user, message }, context )
		} )
		.then( result => {
			if ( ! result ) {
				throw new Error( `middleware prevented message(id:${ message.id }) from being sent from ${ origin } to ${ destination } in chat ${ chat.id }` )
			}
			resolveMiddleware( result )
		} )
		.catch( e => debug( e.message ) )
	} )

	chats
	.on( 'miss', ( e, chat ) => {
		debug( 'failed to find operator', e, chat, e.stack )
		const { id: chat_id } = chat;
		const user = {
			id: -1,
			displayName: 'Agent W',
			avatarURL: 'https://wapuuclub.files.wordpress.com/2015/12/original_wapuu.png'
		};
		const message = makeEventMessage( NO_OPS_AVAILABLE_MSG, chat_id );
		message.type = 'message';
		message.user = user;
		debug( 'sending message', { id: chat_id }, user, message );
		operators.emit( 'message', { id: chat_id }, user, message );
		customers.emit( 'chat.unavailable', chat );
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
	toAgents( customers, 'disconnect', 'customer.disconnect' ) // TODO: do we want to wait till timer triggers?

	customers.on( 'join', ( socketIdentifier, user, socket ) => {
		debug( 'emitting chat log' )
		log.customer.findLog( user.id )
		.then( ( messages ) => socket.emit( 'log', messages ) )
	} )

	operators.on( 'join', ( chat, operator, socket ) => {
		debug( 'emitting chat log to operator', operator.id )
		log.operator.findLog( chat.id )
		.then( ( messages ) => {
			socket.emit( 'log', chat, messages )
		} )
	} )

	customers.on( 'typing', ( chat, user, text ) => {
		operators.emit( 'receive.typing', chat, user, text )
	} )

	operators.on( 'typing', ( chat, user, text ) => {
		operators.emit( 'receive.typing', chat, user, text )
		customers.emit( 'receive.typing', chat, user, text )
	} )

	customers.on( 'message', ( chat, message ) => {
		// broadcast the message to
		debug( 'customer message', chat.id, message.id, message )
		const origin = 'customer'
		runMiddleware( { origin, destination: 'customer', chat, message } )
		.then( m => new Promise( ( resolve, reject ) => {
			log.customer.recordCustomerMessage( chat, m )
			.then( () => resolve( m ), reject )
		} ) )
		.then( m => customers.emit( 'receive', chat, m ) )
		.catch( e => debug( 'middleware failed ', e ) )

		runMiddleware( { origin, destination: 'agent', chat, message } )
		.then( m => agents.emit( 'receive', formatAgentMessage( 'customer', chat.id, chat.id, m ) ) )
		.catch( e => debug( 'middleware failed', e ) )

		runMiddleware( { origin, destination: 'operator', chat, message } )
		.then( m => new Promise( ( resolve, reject ) => {
			log.operator.recordCustomerMessage( chat, m )
			.then( () => resolve( m ), reject )
		} ) )
		.then( m => operators.emit( 'receive', chat, m ) )
		.catch( e => debug( 'middleware failed', e ) )
	} )

	operators.on( 'message', ( chat, operator, message ) => {
		debug( 'operator message', chat, message )
		const origin = 'operator'

		runMiddleware( { origin, destination: 'agent', chat, message, user: operator } )
		.then( m => agents.emit( 'receive', formatAgentMessage( 'operator', message.user.id, chat.id, m ) ) )

		runMiddleware( { origin, destination: 'operator', chat, message, user: operator } )
		.then( m => new Promise( ( resolve, reject ) => {
			log.operator.recordOperatorMessage( chat, operator, m )
			.then( () => resolve( m ), reject )
		} ) )
		.then( m => operators.emit( 'receive', chat, m ) )

		runMiddleware( { origin, destination: 'customer', chat, message, user: operator } )
		.then( m => new Promise( ( resolve, reject ) => {
			log.customer.recordOperatorMessage( chat, operator, m )
			.then( () => resolve( m ), reject )
		} ) )
		.then( m => customers.emit( 'receive', chat, m ) )
	} )

	agents.on( 'message', ( message ) => {
		const chat = { id: message.session_id }
		const format = ( m ) => assign( {}, { author_type: 'agent' }, m )
		const origin = 'agent'

		runMiddleware( { origin, destination: 'agent', chat, message } )
		.then( m => agents.emit( 'receive', assign( {}, { author_type: 'agent' }, m ) ) )

		runMiddleware( { origin, destination: 'operator', chat, message } )
		.then( m => new Promise( ( resolve, reject ) => {
			log.operator.recordAgentMessage( chat, m )
			.then( () => resolve( m ), reject )
		} ) )
		.then( m => operators.emit( 'receive', chat, format( m ) ) )

		runMiddleware( { origin, destination: 'customer', chat, message } )
		.then( m => new Promise( ( resolve, reject ) => {
			log.customer.recordAgentMessage( chat, message )
			.then( () => resolve( m ), reject )
		} ) )
		.then( m => customers.emit( 'receive', chat, format( m ) ) )
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
