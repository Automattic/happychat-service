import { compose, equals, invoker, when } from 'ramda';

const typeOf = v => typeof( v )

/**
 * Converts numbers to string values. Used mostly to support ramda functions
 * that require string arugments like assoc, dissoc, prop and path.
 *
 * @param {Object} object Any object to convert to a string
 * @returns String value of the string
 * @type String
 */

export default when(
	compose(
		equals( 'number' ),
		typeOf
	),
	invoker( 0, 'toString' )
)
