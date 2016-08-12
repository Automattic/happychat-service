import { v4 as uuid } from 'uuid'

const debug = require( 'debug' )( 'happychat:util' )

const asCallback = ( { resolve, reject } ) => ( error, result ) => {
	if ( error ) return reject( error )
	resolve( result )
}

const connect = ( { events, socket } ) => new Promise( ( resolve, reject ) => {
	events.emit( 'connection', socket, asCallback( { resolve, reject } ) )
} )

const rejectAndClose = ( socket ) => ( e ) => {
	debug( 'closing socket', e )
	socket.emit( 'unauthorized' )
	socket.close()
}

export const timestamp = () => (
	Math.ceil( ( new Date() ).getTime() / 1000 )
)

export const onConnection = ( { events, socket } ) => ( success ) => connect( { events, socket } ).then( success, rejectAndClose( socket ) )

export const makeEventMessage = ( text, session_id ) => ( {
	type: 'event',
	id: uuid(),
	timestamp: timestamp(),
	session_id: session_id,
	text
} )
