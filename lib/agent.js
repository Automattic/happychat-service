const debug = require( 'debug' )( 'tinkerchat:agent' )

const authenticate = ( authenticator ) => new Promise( ( resolve, reject ) => {
	authenticator( ( error, agent ) => {
		if ( error ) return reject( error )
		resolve( agent )
	} )
} )

// change a lib/customer message to what an agent client expects
const formatCustomerMessage = ( { id, timestamp, text, user } ) => ( {
	id, timestamp, text,
	context:     user.id,
	author_id:   user.id,
	author_type: 'customer'
} )

const onAuthorized = ( { socket, customers } ) => ( agent ) => {
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
	customers.on( 'message', ( message ) => socket.emit(
		'message',
		formatCustomerMessage( message ) )
	)
	socket.emit( 'init', { agent } )
}

const onConnection = ( { authenticator, customers } ) => ( socket ) => {
	authenticate( authenticator )
	.then( onAuthorized( { socket, customers } ) )
	.catch( ( e ) => {
		debug( 'unauthorized agent', e )
		socket.emit( 'unauthorized' )
		socket.close()
	} )
}

export default ( io, { customers, authenticator } ) => io.on( 'connection', onConnection( { authenticator, customers } ) )
