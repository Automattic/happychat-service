import { whenActionTypeIs, beforeNextAction } from './handlers'
import { OPERATOR_READY } from '../../action-types'
import { isOperatorMemberOfAnyGroup, DEFAULT_GROUP_ID } from '../../groups/selectors'
import { addGroupMember } from '../../groups/actions'

const debug = require( 'debug' )( 'happychat-debug:operator-default-group' )

export default store => beforeNextAction( whenActionTypeIs( OPERATOR_READY, ( action ) => {
	const { user } = action
	// If the operator is not a member of any groups they should be
	// assigned to the default group
	debug( 'Checking operator group assignment' )
	if ( ! isOperatorMemberOfAnyGroup( user.id, store.getState() ) ) {
		store.dispatch( addGroupMember( DEFAULT_GROUP_ID, user.id ) )
	}
} ) )
