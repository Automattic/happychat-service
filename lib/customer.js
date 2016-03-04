const debug = require( 'debug' )( 'tinkerchat:service:customer' )

export default ( io ) => {
	io.on( 'connection', ( socket ) => {
		debug( 'customer connected' )
	} )
}
