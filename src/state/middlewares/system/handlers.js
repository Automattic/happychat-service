import { tap, cond, T, identity, propEq, pipe, when } from 'ramda'

export const handleActionType = ( type, handler ) => [
	propEq( 'type', type ),
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
