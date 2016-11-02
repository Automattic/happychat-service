import {
	SET_ACCEPTS_CUSTOMERS
} from './actions'

export default ( { action, user } ) => {
	if ( ! user ) {
		return false
	}

	switch ( action.type ) {
		case SET_ACCEPTS_CUSTOMERS:
			return true
		default:
			return false
	}
}
