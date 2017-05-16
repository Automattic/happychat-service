import { deepEqual } from 'assert';

import reducer from 'state/locales/reducer';
import { addOperatorLocale } from 'state/locales/actions';

describe( 'state/locales/reducer', () => {
	it( 'SET_OPERATOR_CAPACITY' );
	it( 'JOIN_LOCALE' );
	it( 'LEAVE_LOCALE' );
	it( 'CONFIGURE_LOCALES' );
	it( 'SET_USER_LOADS' );
	it( 'ADD_USER_LOCALE', () => {
		const state = {
			supported: [ 'en', 'es', 'pt-BR' ],
			defaultLocale: 'en',
			memberships: {}
		};
		deepEqual(
			reducer( state, addOperatorLocale( 'en', 234456 ) ).memberships.en,
			{ 234456: { active: true, capacity: 3, load: 0 } }
		);
	} );
} );
