import { getChats } from '../../chat-list/selectors'
import { selectIdentities } from '../../operator/selectors'
import { agentInboundMessage, AGENT_RECEIVE_MESSAGE } from '../../chat-list/actions'

const debug = require( 'debug' )( 'happychat:agent' )

const onAuthorized = ( { socket, agent, store } ) => {
	const { getState, dispatch } = store
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
		dispatch( agentInboundMessage( agent, message ) )
	} )

	socket.on( 'system.info', done => {
		const operators = selectIdentities( getState() );
		const chats = getChats( getState() );
		done( { chats, operators } )
	} )

	socket.on( 'role.add', ( role, done ) => {
		debug( 'agent joining role', role )
		socket.join( role, e => {
			if ( e ) {
				return debug( 'failed to add agent role', role, e.description )
			}
			done()
		} )
	} )

	socket.emit( 'init', agent )
}

export default ( io, auth ) => store => {
	io.on( 'connection', socket => auth( socket ).then(
		agent => onAuthorized( { socket, store, agent } ),
		e => debug( 'connection closed', e.description )
	) )
		// {
// 		auth( socket, user => onAuthorized( { socket, store, agent: user } ) )
// 	} )
	// const handleCustomerJoin = action => {
	// 	const { user, chat, socket } = action
	// 	events.emit( 'customer.join', user, chat, socket )
	// }
	//
	// const handleCustomerDisconnect = action => {
	// 	events.emit( 'customer.disconnect', action.chat, action.user )
	// }

	return next => action => {
		switch ( action.type ) {
			// case CUSTOMER_DISCONNECT:
			// 	handleCustomerDisconnect( action )
			// 	break;
			// case CUSTOMER_JOIN:
			// 	handleCustomerJoin( action )
			// 	break;
			case AGENT_RECEIVE_MESSAGE:
				io.emit( 'message', action.message )
				break;
		}
		return next( action )
	}
}
