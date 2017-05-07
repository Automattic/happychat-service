import { ok } from 'assert'

export * from 'assert'

export const contains = ( container, ... elements ) => {
	elements.forEach( ( element ) => ok( container.indexOf( element ) > -1 ) )
}
