import assert from 'assert';
import mockService, { authenticators } from './helpers';
import { applyMiddleware } from 'redux';

describe( 'Store', () => {
	const mockUser = {
		id: 'mock-user-id',
		displayName: 'Nasuicaä',
		username: 'nausicaa',
		picture: 'http://example.com/nausicaa',
		session_id: 'mock-session-id'
	};
	const opUser = {
		id: 'operator-id',
		displayName: 'Ridley',
		username: 'ridley',
		picture: 'http://sample.com/ridley'
	};

	let enhancerRan = false;
	const enhancerTester = () => next => action => {
		enhancerRan = true;
		return next( action );
	};

	const server = mockService( authenticators( mockUser, opUser, {} ), [ applyMiddleware( enhancerTester ) ] );

	beforeEach( () => server.start() );
	afterEach( () => server.stop() );

	it( 'should take middlewares passed when creating the service', () => {
		server.service.store.dispatch( {
			type: 'TESTING_USER_MIDDLEWARE',
			text: 'testing user middleware'
		} );
		return assert( enhancerRan );
	} );
} );
