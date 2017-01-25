import { REMOTE_USER_KEY } from 'state/middlewares/socket-io/broadcast'
import { merge, objOf } from 'ramda'

export const remoteAction = ( action, remoteUser = { id: 'remote-user' } ) => merge(
	action,
	objOf( REMOTE_USER_KEY, remoteUser )
)
