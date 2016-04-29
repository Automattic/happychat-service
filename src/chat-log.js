import { get, set } from 'lodash/object'

const debug = require( 'debug' )( 'tinkerchat:chat-log' )
const DEFAULT_MAX_MESSAGES = 100
export class ChatLog {

	constructor( options = { maxMessages: DEFAULT_MAX_MESSAGES } ) {
		this.maxMessages = options.maxMessages
		this.chats = {}
	}

	append( id, message ) {
		debug( 'append message', id, message.id )
		return this.findLog( id )
		.then( ( log ) => new Promise( ( resolve ) => {
			set( this.chats, id, log.concat( message ).slice( - this.maxMessages ) )
			resolve()
		} ) )
	}

	findLog( id ) {
		return new Promise( ( resolve ) => {
			resolve( get( this.chats, id, [] ) )
			debug( 'found log', id )
		} )
	}

	recordCustomerMessage( chat, message ) {
		return this.append( chat.id, message )
	}

	recordOperatorMessage( chat, operator, message ) {
		return this.append( chat.id, message )
	}

	recordAgentMessage( chat, message ) {
		return this.append( chat.id, message )
	}
}
