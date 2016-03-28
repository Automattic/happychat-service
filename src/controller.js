const debug = require( 'debug' )( 'tinkerchat:controller' )

// change a lib/customer message to what an agent client expects
const formatAgentMessage = ( author_type, author_id, context, { id, timestamp, text } ) => ( {
	id, timestamp, text,
	context,
	author_id,
	author_type
} )

const forward = ( dest ) => ( org, event, dstEvent ) => {
	org.on( event, ( ... args ) => dest.emit( dstEvent ? dstEvent : event, ... args ) )
}

const on = ( emitter, event, listener ) => emitter.on( event, listener )

export default ( { customers, agents } ) => {
	const toAgents = forward( agents )

	on( customers, 'message', ( { id }, message ) => {
		debug( 'received customer message', message )
		agents.emit( 'receive', formatAgentMessage( 'customer', id, id, message ) )
	} )

	// forward customer join and leave events to agents
	toAgents( customers, 'join', 'customer.join' )
	toAgents( customers, 'leave', 'customer.leave' )

	on( agents, 'message', ( message ) => {
		debug( 'received agent message', message )
		customers.emit( 'receive', Object.assign( {}, { author_type: 'agent' }, message ) )
	} )
}
