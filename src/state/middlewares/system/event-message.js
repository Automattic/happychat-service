import { v4 as uuid } from 'uuid'
import timestamp from '../../timestamp'

export default ( text, session_id ) => ( {
	type: 'event',
	id: uuid(),
	timestamp: timestamp(),
	session_id: session_id,
	text
} )
