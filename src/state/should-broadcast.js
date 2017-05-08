import {
	OPERATOR_TYPING,
	OPERATOR_RECEIVE_TYPING,
	CUSTOMER_TYPING,
	CUSTOMER_RECEIVE_TYPING
} from './action-types';

export default ( { type } ) => {
	switch ( type ) {
		case OPERATOR_TYPING:
		case OPERATOR_RECEIVE_TYPING:
		case CUSTOMER_TYPING:
		case CUSTOMER_RECEIVE_TYPING:
			return false;
	}
	return true;
};
