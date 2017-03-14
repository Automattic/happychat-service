import { tap, cond, propEq, pipe, when, prop, contains } from 'ramda'

export const handleActionType = ( type, handler ) => [
	propEq( 'type', type ),
	tap( handler )
]

export const handleActionTypes = ( types, handler ) => [
	pipe( prop( 'type' ), type => contains( type, types ) ),
	tap( handler )
]

export const handlers = ( ... conditions ) => cond(
	[ ... conditions ]
)

export const beforeNextAction = fn => next => pipe(
	tap( next ),
	tap( fn )
)

export const whenActionTypeIs = ( type, fn ) => when( propEq( 'type', type ), tap( fn ) )
