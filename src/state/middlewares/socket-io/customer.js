import {
	map,
	isEmpty,
	compose,
	tap,
} from 'ramda';
import { throttle } from 'lodash';
import {
	CUSTOMER_RECEIVE_TYPING,
	CUSTOMER_RECEIVE_MESSAGE,
	CUSTOMER_JOIN,
	INSERT_PENDING_CHAT,
	SET_CHAT_MISSED,
	NOTIFY_SYSTEM_STATUS_CHANGE,
	NOTIFY_CHAT_STATUS_CHANGED,
	SEND_CUSTOMER_CHAT_LOG,
	CUSTOMER_CHAT_TRANSCRIPT_FAILURE,
	CUSTOMER_SEND_CHAT_TRANSCRIPT_RESPONSE,
	CUSTOMER_BLOCK
} from '../../action-types';
import {
	assignNextChat,
	customerInboundMessage,
	customerTyping,
	customerJoin,
	customerSocketDisconnect,
	customerDisconnect,
	customerChatTranscriptRequest,
} from '../../chatlist/actions';
import {
	getChatStatus,
	getChatsWithStatuses
} from '../../chatlist/selectors';
import {
	STATUS_CLOSED,
	STATUS_NEW
} from '../../chatlist/reducer';
import {
	canAcceptChat
} from '../../operator/selectors';
import timestamp from '../../timestamp';

export const customerRoom = id => `customer/${ id }`;

const log = require( 'debug' )( 'happychat:middleware:chatlist' );

// limit the information for the user
const identityForUser = ( { id, name, username, picture } ) => ( { id, name, username, picture } );

const haveOtherConnections = ( io, room ) => new Promise( ( resolve, reject ) => {
	io.in( room ).clients( ( error, clients ) => {
		if ( error ) {
			return reject( error );
		}

		resolve( clients.length > 0 );
	} );
} );

const init = ( { user, socket, io, dispatch, chat } ) => () => {
	socket.on( 'message', ( { text, id, meta } ) => {
		const message = { session_id: chat.id, id: id, text, timestamp: timestamp(), user: identityForUser( user ), meta };
		// all customer connections for this user receive the message
		dispatch( customerInboundMessage( chat, message, user ) );
	} );

	socket.on( 'typing', throttle( ( text ) => {
		dispatch( customerTyping( chat.id, user, text ) );
	}, 100, { leading: true } ) );

	socket.on( 'disconnect', () => {
		dispatch( customerSocketDisconnect( socket.id, chat, user ) );

		haveOtherConnections( io, customerRoom( chat.id ) )
			.then( stillConnected => {
				if ( ! stillConnected ) {
					dispatch( customerDisconnect( chat, user ) );
				}
			} );
	} );

	socket.on( 'transcript', ( transcript_timestamp ) => {
		dispatch( customerChatTranscriptRequest( socket.id, chat.id, transcript_timestamp ) );
	} );

	socket.emit( 'init', user );
	dispatch( customerJoin( chat, user ) );
};

const join = ( { io, user, socket, dispatch }, middlewares ) => {
	const chat = {
		user_id: user.id,
		id: user.session_id,
		username: user.username,
		name: user.displayName,
		picture: user.picture,
		locale: user.locale,
		groups: user.groups
	};
	socket.join( customerRoom( chat.id ), init( { user, socket, io, dispatch, chat }, middlewares ) );
};

export default ( { io, timeout = 1000 }, customerAuth, middlewares = [] ) => store => {
	io.on( 'connection', socket => {
		customerAuth( socket ).then(
			user => join( { socket, user, io, dispatch: store.dispatch }, middlewares ),
			e => {
				socket.emit( 'unauthorized' );
				log( 'customer auth failed', e.message );
			}
		);
	} );

	const handleCustomerReceiveMessage = action => {
		const { id, message } = action;
		io.to( customerRoom( id ) ).emit( 'message', message );
	};

	const handleCustomerReceiveTyping = action => {
		const { id, text } = action;
		io.to( customerRoom( id ) ).emit( 'typing', text && ! isEmpty( text ) );
	};

	const handleCustomerJoin = action => {
		const { chat } = action;
		const accept = canAcceptChat( chat.id, store.getState() );
		io.to( customerRoom( chat.id ) ).emit( 'accept', accept );
	};

	const handleNotifiSystemStatusChange = () => {
		// get all new chats and notify their status
		compose(
			map( tap( chat => {
				io
					.to( customerRoom( chat.id ) )
					.emit( 'accept', canAcceptChat( chat.id, store.getState() ) );
			} ) ),
			state => getChatsWithStatuses( [ STATUS_CLOSED, STATUS_NEW ], state ),
		)( store.getState() );
	};

	const handleSendCustomerChatLog = action => {
		io.to( customerRoom( action.id ) ).emit( 'log', action.log );
	};

	const hadleChatTranscriptResponse = action => {
		io.to( action.socketId ).emit(
			'transcript',
			{ timestamp: action.timestamp, messages: action.messages }
		);
	};

	const handleChatTranscriptFailure = action => {
		io.to( action.socketId ).emit(
			'transcript.failure',
			action.errorMessage
		);
	};

	const handleCustomerBlock = action => {
		// notify status to customer
		io.to( customerRoom( action.chat_id ) ).emit( 'accept', false );
	};

	return next => action => {
		switch ( action.type ) {
			case NOTIFY_SYSTEM_STATUS_CHANGE:
				handleNotifiSystemStatusChange( action );
				break;
			case NOTIFY_CHAT_STATUS_CHANGED:
				const status = getChatStatus( action.chatID, store.getState() );
				io.to( customerRoom( action.chatID ) ).emit( 'status', status );
				break;
			case CUSTOMER_RECEIVE_TYPING:
				handleCustomerReceiveTyping( action );
				return next( action );
			case CUSTOMER_RECEIVE_MESSAGE:
				handleCustomerReceiveMessage( action );
				return next( action );
			case CUSTOMER_JOIN:
				handleCustomerJoin( action );
				return next( action );
			case CUSTOMER_BLOCK:
				handleCustomerBlock( action );
				break;
			case SEND_CUSTOMER_CHAT_LOG:
				handleSendCustomerChatLog( action );
				break;
			case CUSTOMER_SEND_CHAT_TRANSCRIPT_RESPONSE:
				hadleChatTranscriptResponse( action );
				break;
			case CUSTOMER_CHAT_TRANSCRIPT_FAILURE:
				handleChatTranscriptFailure( action );
				break;
		}
		const result = next( action );
		switch ( action.type ) {
			case SET_CHAT_MISSED:
			case INSERT_PENDING_CHAT:
				store.dispatch( assignNextChat() );
				break;
		}
		return result;
	};
};
