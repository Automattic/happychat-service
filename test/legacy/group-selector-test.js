import { ok, equal } from 'assert';
import { isOperatorMemberOfAnyGroup, getDefaultLocaleGroup } from 'state/groups/selectors';

describe( 'Group selectors', () => {
	it( 'isOperatorMemberOfAnyGroup', () => {
		ok( isOperatorMemberOfAnyGroup( 1, { groups: {
			somegroup: { members: {
				1: true
			} }
		} } ) );

		ok( ! isOperatorMemberOfAnyGroup( 2, { groups: {
			othergroup: { members: {
				1: true
			} }
		} } ) );
	} );

	it( 'getDefaultLocaleGroup', () => {
		equal( 'en-__default', getDefaultLocaleGroup( {
			locales: { defaultLocale: 'en' },
			groups: {
				__default: { id: '__default' }
			}
		} ) );
	} );
} );
