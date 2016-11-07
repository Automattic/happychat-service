import {
	SET_SYSTEM_ACCEPTS_CUSTOMERS
} from './actions'

export default ( { action, user } ) => {
	if ( ! user ) {
		return false
	}

	switch ( action.type ) {
		case SET_SYSTEM_ACCEPTS_CUSTOMERS:
			return true
		default:
			return false
	}
}
