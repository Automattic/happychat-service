import { v4 as uuid } from 'uuid';
import { compose, equals, invoker, when } from 'ramda';

export const timestamp = () => (
	Math.ceil( ( new Date() ).getTime() / 1000 )
)

export const makeEventMessage = ( text, session_id ) => ( {
	type: 'event',
	id: uuid(),
	timestamp: timestamp(),
	session_id: session_id,
	text
} )

const typeOf = v => typeof( v )
export const asString = when(
	compose(
		equals( 'number' ),
		typeOf
	),
	invoker( 0, 'toString' )
)
