const debug = require( 'debug' )( 'tinkerchat:controller' )

export default ( { customers, agents } ) => {
	customers.on( 'message', ( message ) => {
		debug( 'received customer message', message )
		agents.emit( 'receive', message )
	} )
	agents.on( 'message', ( message ) => {
		debug( 'received agent message', message )
		customers.emit( 'receive', message )
	} )
}
