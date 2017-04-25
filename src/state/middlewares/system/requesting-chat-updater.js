import { setOperatorRequestingChat } from '../../operator/actions';
import { withRemoteUser } from '../socket-io/lib';
import { SET_CHAT_OPERATOR } from '../../action-types';

export default ( { dispatch } ) => next => action => {
	const nextState = next( action );

	if ( action.type === SET_CHAT_OPERATOR ) {
		dispatch( withRemoteUser( setOperatorRequestingChat( false ), action.operator ) );
	}

	return nextState;
}
