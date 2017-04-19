import { getChats } from '../../chatlist/selectors';
import { getOperators } from '../../operator/selectors';
import { AGENT_RECEIVE_MESSAGE, AGENT_SYSTEM_INFO } from '../../action-types';
import { agentInboundMessage } from '../../chatlist/actions';

const debug = require( 'debug' )( 'happychat-debug:agent' );

const onAuthorized = ( { socket, agent, dispatch } ) => {
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
		dispatch( agentInboundMessage( agent, message ) );
	} );

	socket.on( 'system.info', () => {
		dispatch( { type: AGENT_SYSTEM_INFO, socketId: socket.id } );
	} );

	socket.on( 'role.add', ( role, done ) => {
		debug( 'agent joining role', role );
		socket.join( role, e => {
			if ( e ) {
				return debug( 'failed to add agent role', role, e.message );
			}
			done();
		} );
	} );

	socket.emit( 'init', agent );
};

export default ( io, auth ) => store => {
	const { dispatch, getState } = store;
	io.on( 'connection', socket => auth( socket ).then(
		agent => onAuthorized( { socket, dispatch, agent } ),
		e => debug( 'connection closed', e.message )
	) );

	return next => action => {
		switch ( action.type ) {
			case AGENT_RECEIVE_MESSAGE:
				io.emit( 'message', action.message );
				break;
			case AGENT_SYSTEM_INFO:
				const operators = getOperators( getState() );
				const chats = getChats( getState() );
				io.to( action.socketId ).emit( 'system.info', { operators, chats } );
		}
		return next( action );
	};
};
