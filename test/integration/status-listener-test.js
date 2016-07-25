import util, { authenticators } from './util'
import { deepEqual, equal } from 'assert'

const debug = require( 'debug' )( 'happychat:test:operator-status' )

describe( 'Operator API', () => {
	const user = { id: 'op-id', name: 'Operator name' }
	const server = util( authenticators( {}, user ) )
	const { service: { operators } } = server

	beforeEach( () => server.start() )
	afterEach( () => server.stop() )

	it( 'should allow operator status observers', ( done ) => {
		// operators is a property of the service (./src/service) and is the event bus
		// for the operator API
		operators.on( 'status', ( operator, status ) => {
			deepEqual( operator, user )
			equal( status, 'available' )
			done()
		} )
		server.startOperator( user ).then( ( client ) => {
			client.on( 'init', ( user ) => client.emit( 'status', 'available' ) )
		} )
	} )
} )
