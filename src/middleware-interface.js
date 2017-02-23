import isEmpty from 'lodash/isEmpty'
import assign from 'lodash/assign'

const debug = require( 'debug' )( 'happychat-debug:middleware' )

const runMiddleware = middlewares => ( { origin, destination, chat, user, message } ) => new Promise( ( resolveMiddleware ) => {
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
				debug( 'middleware complete', chat.id, data.type )
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
	.catch( e => debug( e.message, e ) )
} )

export default () => {
	const middlewares = []
	const external = {
		middleware: ( middleware ) => {
			if ( middleware.length >= 2 ) {
				middlewares.push( ( ... args ) => new Promise( resolve => middleware( ... args.concat( resolve ) ) ) )
			} else {
				middlewares.push( middleware )
			}
			return external
		}
	}
	return {
		middlewares: () => middlewares,
		external
	}
}

export { runMiddleware as run }
