import { ok } from 'assert'
import { isOperatorMemberOfAnyGroup } from 'state/groups/selectors'

describe( 'Group selectors', () => {
	it( 'isOperatorMemberOfAnyGroup', () => {
		ok( isOperatorMemberOfAnyGroup( 1, { groups: {
			somegroup: { members: {
				1: true
			} }
		} } ) )

		ok( !isOperatorMemberOfAnyGroup( 2, { groups: {
			othergroup: { members: {
				1: true
			} }
		} } ) )
	} )
} )
