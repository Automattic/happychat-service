import { path, defaultTo, compose, prop } from 'ramda'

import { DEFAULT_GROUP_ID } from './reducer'

export { DEFAULT_GROUP_ID }
export const getGroups = prop( 'groups' )

export const getGroup = ( groupID, state ) => compose(
	defaultTo( {} ),
	path( [ 'groups', groupID ] )
)( state )

export const isOperatorMemberOfAnyGroup = ( user, state ) => false
