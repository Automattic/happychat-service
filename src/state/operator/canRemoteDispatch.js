import {
	SET_SYSTEM_ACCEPTS_CUSTOMERS,
	SET_OPERATOR_CAPACITY,
	SET_OPERATOR_STATUS
} from '../action-types'

export default ( { action, user } ) => {
	if ( ! user ) {
		return false
	}

	switch ( action.type ) {
		case SET_SYSTEM_ACCEPTS_CUSTOMERS:
		case SET_OPERATOR_CAPACITY:
		case SET_OPERATOR_STATUS:
			return true
		default:
			return false
	}
}
