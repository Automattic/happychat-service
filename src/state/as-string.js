import { compose, equals, invoker, when } from 'ramda';

const typeOf = v => typeof( v )
export default when(
	compose(
		equals( 'number' ),
		typeOf
	),
	invoker( 0, 'toString' )
)
