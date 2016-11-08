import {
	SET_SYSTEM_ACCEPTS_CUSTOMERS,
	SET_OPERATOR_CAPACITY
} from './actions'

export default ( { action, user } ) => {
	if ( ! user ) {
		return false
	}

	switch ( action.type ) {
		case SET_SYSTEM_ACCEPTS_CUSTOMERS:
			return true
		case SET_OPERATOR_CAPACITY:
			return user.id === action.user_id
		default:
			return false
	}
}
