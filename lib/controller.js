const debug = require( 'debug' )( 'tinkerchat:controller' )

// change a lib/customer message to what an agent client expects
const formatAgentMessage = ( author_type, author_id, context, { id, timestamp, text } ) => ( {
	id, timestamp, text,
	context,
	author_id,
	author_type
} )

export default ( { customers, agents } ) => {
	customers.on( 'message', ( { id }, message ) => {
		debug( 'received customer message', message )
		agents.emit( 'receive', formatAgentMessage( 'customer', id, id, message ) )
	} )
	customers.on( 'join', ( ... args ) => {
		agents.emit( 'join', ... args )
	} )
	agents.on( 'message', ( message ) => {
		// TODO: send agent message to correct customer room
		debug( 'received agent message', message )
		customers.emit( 'receive', Object.assign( {}, { author_type: 'agent' }, message ) )
	} )
}
