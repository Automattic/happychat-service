import { path, compose, defaultTo, map, when, merge, mergeAll, has, values } from 'ramda';

const normalizeLocale = locale => locale;

/**
 * Gets the system's default locale setting.
 *
 * @param { Object } state - redux state
 * @returns  { String } default locale code (e.g. "en-US")
 */
export const getDefaultLocale = path( [ 'locales', 'defaultLocale' ] );

/**
 * Gets the list of supported locales.
 *
 * @param { Object } state - redux global state
 * @returns { String[] } list of supported locales.
 */
export const getSupportedLocales = compose(
	defaultTo( [] ),
	path( [ 'locales', 'supported' ] )
);

/**
 * Gets the locale membership information for a specific operator.
 *
 * @param { String } locale - locale code
 * @param { String } user_id - the operator's user id
 * @param { Object } state - redux state
 * @returns { Object } mebership details (e.g. { capacity: 1, active: false } )
 */
export const getLocaleMembership = ( locale, user_id, state ) => compose(
	map( when( isNaN, 0 ) ),
	merge( { capacity: 0, load: 0, active: false } ),
	path( [ 'locales', 'memberships', normalizeLocale( locale ), user_id ] )
)( state );

export const isOperatorMemberOfAnyLocale = ( user_id, state ) => compose(
	has( user_id ),
	mergeAll,
	values,
	path( [ 'locales', 'memberships' ] )
)( state );
