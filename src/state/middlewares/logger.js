import { keys } from 'ramda'

const getTime = () => ( new Date() ).getTime()

const log = require( 'debug' )( 'happychat:store' )
const debug = require( 'debug' )( 'happychat-debug:store' )

export default () => next => action => {
	debug( 'ACTION_START', action.type, ... keys( action ) )
	const startTime = getTime()
	try {
		const result = next( action )
		const endTime = getTime()
		const ellapsed = endTime - startTime
		if ( ellapsed > 100 ) {
			log( 'slow ACTION', action.type )
		}
		debug( 'ACTION_END', action.type )
		return result
	} catch ( e ) {
		log( 'ACTION_ERROR', action.type, e.message )
		debug( 'ACTION', action )
		throw ( e )
	}
}
