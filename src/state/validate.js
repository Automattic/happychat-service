import debug from 'debug';

const log = debug( 'happychat:state' );

/**
 * Higher order function to wrap around a reducer. Validates the reducer each
 * time it's run, logging an error if the state *becomes* invalid when the reducer is run.
 * @param {string} reference A unique name to refer to this validation
 * @param {function} validator The schema to validate the current reducer state against
 * @param {function} reducer The reducer to be wrapped
 * @returns {function} The wrapped reducer function
 */
export const validateReducer = ( reference, validator, reducer ) => ( state, action ) => {
	const validBefore = validator( state );
	const newState = reducer( state, action );
	if ( typeof state === 'undefined' || validBefore ) {
		// Only check the validity after reducer if this is the first
		// time the reducer was run or the state was valid before
		const validAfter = validator( newState );
		if ( ! validAfter ) {
			log( 'State became invalid: ', reference,
				'\n -- Validation errors --\n', validator.errors,
				'\n -- Action -- \n', action,
				'\n -- New state -- \n', newState );
		}
	}
	return newState;
}