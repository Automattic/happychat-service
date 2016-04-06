import EventEmitter from 'events'
import { onConnection } from './util'

const debug = require( 'debug' )( 'tinkerchat:operator' )

const join = ( { socket, events, user, io } ) => {
	// TODO: initialize the agent
	debug( 'initialize the operator', user )
	socket.emit( 'init' )
	socket.on( 'status', ( status ) => {
		debug( 'set operator status', status )
	} )
}

export default ( io ) => {
	const events = new EventEmitter()

	events.on( 'assign', () => {

	} )

	io.on( 'connection', ( socket ) => {
		debug( 'operator connecting' )
		onConnection( { socket, events } )( ( user ) => join( { socket, events, user, io } ) )
	} )

	return events
}
