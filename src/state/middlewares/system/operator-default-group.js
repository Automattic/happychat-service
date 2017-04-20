import { whenActionTypeIs, beforeNextAction } from './handlers';
import { OPERATOR_READY } from '../../action-types';
import { isOperatorMemberOfAnyGroup, DEFAULT_GROUP_ID } from '../../groups/selectors';
import { isOperatorMemberOfAnyLocale, getDefaultLocale } from '../../locales/selectors';
import { addGroupMember } from '../../groups/actions';
import { addOperatorLocale } from '../../locales/actions';

const debug = require( 'debug' )( 'happychat-debug:operator-default-group' )

export default store => beforeNextAction( whenActionTypeIs( OPERATOR_READY, ( action ) => {
	const { user } = action
	// If the operator is not a member of any groups they should be
	// assigned to the default group
	if ( ! isOperatorMemberOfAnyGroup( user.id, store.getState() ) ) {
		store.dispatch( addGroupMember( DEFAULT_GROUP_ID, user.id ) );
	}
	if ( ! isOperatorMemberOfAnyLocale( user.id, store.getState() ) ) {
		store.dispatch( addOperatorLocale(
			getDefaultLocale( store.getState() ),
			user.id
		) );
	}
} ) );
