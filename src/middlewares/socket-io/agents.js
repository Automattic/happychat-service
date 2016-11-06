import { onConnection } from '../../util'

const debug = require( 'debug' )( 'happychat:agent' )

const onAuthorized = ( { socket, events } ) => ( agent ) => {
	// any message sent from a customer needs to be forwarded to the agent socket
	/**
`message`: A message being sent and the context of the message
  - `id`: the id of the message
  - `chat_id`: the conversation this message is for
  - `timestamp`: timestampe of the message
  - `text`: content of the message
  - `context`: the id of the channel the message was sent to
  - `author_id`: the id of the author of the message
  - `author_type`: One of `customer`, `support`, `agent`
	 */
	socket.on( 'message', ( message ) => {
		// TODO: validate message
		debug( 'received message', message )
		events.emit( 'message', message )
	} )

	socket.on( 'system.info', done => {
		events.emit( 'system.info', data => done( data ) )
	} )

	socket.on( 'role.add', ( role, done ) => {
		debug( 'agent joining role', role )
		events.emit( 'role.add', role )
		socket.join( role, done )
	} )

	socket.emit( 'init', agent )
}

export default ( io, agents ) => store => {
	io.on( 'connection', ( socket ) => {
		debug( 'agent connection' )
		onConnection(
			{ socket, events: agents },
			onAuthorized( { socket, events: agents } )
		)
	} )
	agents.on( 'receive', ( message ) => io.emit( 'message', message ) )
	return next => action => next( action )
}
