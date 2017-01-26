import { path, defaultTo, compose } from 'ramda'

export const getGroup = ( groupID, state ) => compose(
	defaultTo( {} ),
	path( [ 'groups', groupID ] )
)( state )
