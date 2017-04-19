import { path, compose, defaultTo, map, when, merge } from 'ramda';

const normalizeLocale = locale => locale;

export const getDefaultLocale = path( [ 'locales', 'defaultLocale' ] );
export const getSupportedLocales = compose(
	defaultTo( [] ),
	path( [ 'locales', 'supported' ] )
);

export const getLocaleMembership = ( locale, user_id, state ) => compose(
	map( when( isNaN, 0 ) ),
	merge( { capacity: 0, load: 0, active: false } ),
	path( [ 'locales', 'memberships', normalizeLocale( locale ), user_id ] )
)( state );
