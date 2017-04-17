
import {
	compose,
	whereEq,
	lensProp,
	set,
	map,
	view,
	dissoc,
	reduce,
	when,
	defaultTo,
	lensIndex,
	assoc,
	not,
	equals,
	both,
	filter,
	prop
} from 'ramda';
import asString from '../as-string';
import {
	INSERT_NEW_CHAT,
	INSERT_PENDING_CHAT,
	SET_CHAT_OPERATOR,
	SET_OPERATOR_CHATS_ABANDONED,
	SET_CHATS_RECOVERED,
	SET_CHAT_CUSTOMER_DISCONNECT,
	ASSIGN_CHAT,
	SET_CHAT_MISSED,
	CLOSE_CHAT,
	AUTOCLOSE_CHAT,
	OPERATOR_JOIN,
	OPERATOR_OPEN_CHAT_FOR_CLIENTS,
	SET_USER_OFFLINE,
	REMOVE_USER,
	OPERATOR_CHAT_LEAVE,
	OPERATOR_CHAT_JOIN,
	OPERATOR_CHAT_TRANSFER,
	UPDATE_CHAT,
	REMOVE_CHAT,
	SERIALIZE
} from '../action-types';

export const STATUS_NEW = 'new';
export const STATUS_PENDING = 'pending';
export const STATUS_MISSED = 'missed';
export const STATUS_ASSIGNED = 'assigned';
export const STATUS_ASSIGNING = 'assigning';
export const STATUS_ABANDONED = 'abandoned';
export const STATUS_CUSTOMER_DISCONNECT = 'customer-disconnect';
export const STATUS_CLOSED = 'closed';

/**
 * Lens to be used in viewing and setting values for a chat record
 */
const statusLens = lensIndex( 0 );
const chatLens = lensIndex( 1 );
const operatorLens = lensIndex( 2 );
const timestampLens = lensIndex( 3 );
const membersLens = lensIndex( 4 );
const localeLens = lensIndex( 5 );
const groupsLens = lensIndex( 6 );

/**
 * Ramda views for retrieving values from the chatlist
 */
export const statusView = view( statusLens );
export const chatView = view( chatLens );
export const operatorView = view( operatorLens );
export const timestampView = view( timestampLens );
export const membersView = view( membersLens );
export const localeView = view( localeLens );
export const groupsView = view( groupsLens );

/**
 * Ramda setters for chatlist records
 */
const setStatus = set( statusLens );
const setChat = set( chatLens );
const setOperator = set( operatorLens );
const setTimestamp = set( timestampLens );
const setMembers = set( membersLens );
const setLocale = set( localeLens );
const setGroups = set( groupsLens );

/**
 * Updates a chat's record using the properties from a chat session context
 *
 * @param { Object } chat - chat session context to use for updates
 * @returns { Function } a funtion that will update a chat record
 */
const updateChat = chat => compose(
	setChat( chat ),
	setLocale( chat.locale ),
	setTimestamp( Date.now() ),
	setGroups( chat.groups ),
);

/**
 * Updates a chat's status and timestamp
 *
 * @param { string } status - new status
 * @param { array } state - the current chat state to be updated
 * @return { Function } a function that updates a chat state to the status and timestamp
 */
const updateStatus = ( status, state ) => compose(
	setTimestamp( Date.now() ),
	setStatus( status )
)( state );

/**
 * Chat reducer for updating/storing a chat's details in an array with the given indexes:
 * - 0 - { string } chat status
 * - 1 - { Object } chat session context
 * - 2 - { string } assigned operator id
 * - 3 - { number } timestamp updated with status changes
 * - 4 - { Object } a map of operator_id: bool of operators in the chat
 * - 5 - { string } the chat's locale
 * - 6 - { string[] } groups for the chat
 *
 * @param { array } state - a chat record's state.
 * @param { Object } action - redux action
 * @returns { array } a chat record
 */
const chat = ( state = [ null, null, null, null, {}, null, null ], action ) => {
	switch ( action.type ) {
		case INSERT_NEW_CHAT:
			return compose(
				setStatus( STATUS_NEW ),
				updateChat( action.chat )
			)( state );
		case INSERT_PENDING_CHAT:
			return compose(
				setStatus( STATUS_PENDING ),
				updateChat( action.chat )
			)( state );
		case UPDATE_CHAT:
			return updateChat( action.chat )( state );
		case CLOSE_CHAT:
		case AUTOCLOSE_CHAT:
			return updateStatus( STATUS_CLOSED, state );
		case SET_CHAT_OPERATOR:
		case SET_CHATS_RECOVERED:
			return compose(
				setMembers( assoc( action.operator.id, true, membersView( state ) ) ),
				setStatus( STATUS_ASSIGNED ),
				setOperator( action.operator ),
			)( state );
		case SET_OPERATOR_CHATS_ABANDONED:
			return updateStatus( STATUS_ABANDONED, state );
		case ASSIGN_CHAT:
			return updateStatus( STATUS_ASSIGNING, state );
		case SET_CHAT_MISSED:
			return updateStatus( STATUS_MISSED, state );
		case OPERATOR_CHAT_TRANSFER:
		case OPERATOR_CHAT_LEAVE:
		case SET_USER_OFFLINE:
		case REMOVE_USER:
			return setMembers(
				dissoc( asString( action.user.id ), membersView( state ) ),
				state
			);
		case OPERATOR_CHAT_JOIN:
		case OPERATOR_JOIN:
			return setMembers(
				assoc( action.user.id, true, membersView( state ) ),
				state
			);
		case OPERATOR_OPEN_CHAT_FOR_CLIENTS:
			return setMembers(
				assoc( action.operator.id, true, membersView( state ) ),
				state
			);
		case SET_CHAT_CUSTOMER_DISCONNECT:
			return updateStatus( STATUS_CUSTOMER_DISCONNECT, state );
	}
	return state;
};

const whereOperatorIs = id => compose(
	whereEq( { id } ),
	defaultTo( {} ),
	operatorView
);
const whereStatusIsNot = status => compose(
	not,
	equals( status ),
	statusView
);

const onlyOpen = filter( compose(
	equals( STATUS_ASSIGNED ),
	statusView,
) );

/**
 * Chatlist reducer that manages a list of chats.
 *
 * @param { Object } state - chats indexed by id
 * @param { Object } action - redux action
 * @return { Object } chats indexed by chat id
 */
export default ( state = {}, action ) => {
	switch ( action.type ) {
		case SERIALIZE:
			return onlyOpen( state );
		case REMOVE_CHAT:
			return dissoc( asString( action.id ), state );
		case AUTOCLOSE_CHAT:
			return assoc( action.id, chat( view( lensProp( action.id ), state ), action ), state );
		case SET_CHAT_MISSED:
		case SET_CHAT_OPERATOR:
		case OPERATOR_CHAT_TRANSFER:
		case OPERATOR_CHAT_JOIN:
		case OPERATOR_CHAT_LEAVE:
		case SET_CHAT_CUSTOMER_DISCONNECT:
		case CLOSE_CHAT:
			const chatIdLens = lensProp( action.chat_id );
			return set( chatIdLens, chat( view( chatIdLens, state ), action ) )( state );
		case INSERT_PENDING_CHAT:
		case INSERT_NEW_CHAT:
		case OPERATOR_OPEN_CHAT_FOR_CLIENTS:
		case ASSIGN_CHAT:
		case OPERATOR_JOIN:
		case UPDATE_CHAT:
			const lens = lensProp( action.chat.id );
			return assoc(
				asString( action.chat.id ),
				chat( view( lens, state ), action ),
				state
			);
		case SET_CHATS_RECOVERED:
			return reduce(
				( chats, chatId ) => assoc(
					chatId,
					chat( prop( chatId, chats ), action ),
					chats
				),
				state,
				action.chat_ids
			);
		case SET_OPERATOR_CHATS_ABANDONED:
			return map(
				when(
					both(
						whereOperatorIs( action.operator_id ),
						whereStatusIsNot( STATUS_CLOSED )
					),
					value => chat( value, action )
				)
			)( state );
		case REMOVE_USER:
		case SET_USER_OFFLINE:
			return map( ( chatState ) => chat( chatState, action ), state );
	}
	return state;
};
