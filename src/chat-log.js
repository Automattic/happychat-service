import { get, set, assign } from 'lodash/object'

export class ChatLog {

	constructor() {
		this.chats = {}
	}

	append( id, message ) {
		return this.findLog( id )
		.then( ( log ) => new Promise( ( resolve ) => {
			set( this.chats, id, log.concat( message ) )
			resolve()
		} ) )
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
