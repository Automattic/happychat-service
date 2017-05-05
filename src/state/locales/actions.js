import { CONFIGURE_LOCALES, ADD_USER_LOCALE } from '../action-types';

/**
 * Sets the default locale and locales supported by the system.
 *
 * @param { String } defaultLocale - locale the system uses when no locale is specified
 * @param { String[] } supported - list of supported locales
 * @returns { Object } redux action
 */
export const configureLocales = ( defaultLocale, supported ) => ( {
	type: CONFIGURE_LOCALES,
	defaultLocale,
	supported
} );

/**
 * @param { String } locale - locale code to add operator to
 * @param { String } operator_id - id of operator being added to locale
 * @returns { Object } redux action
 */
export const addOperatorLocale = ( locale, operator_id ) => ( {
	type: ADD_USER_LOCALE, locale, operator_id
} );
