import { v4 as uuid } from 'uuid'

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
