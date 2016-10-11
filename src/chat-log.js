import { get, set } from 'lodash/object'

const DEFAULT_MAX_MESSAGES = 100

export class ChatLog {

	constructor( options = { maxMessages: DEFAULT_MAX_MESSAGES } ) {
		this.maxMessages = options.maxMessages
		this.chats = {}
	}

	append( id, message ) {
		return new Promise( ( resolve ) => {
			set( this.chats, id, get( this.chats, id, [] ).concat( message ).slice( - this.maxMessages ) )
			resolve()
		} )
	}

	findLog( id ) {
		return new Promise( ( resolve ) => {
			resolve( get( this.chats, id, [] ) )
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
