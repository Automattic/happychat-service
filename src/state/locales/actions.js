import { CONFIGURE_LOCALES, ADD_USER_LOCALE } from '../action-types';

export const configureLocales = ( defaultLocale, supported ) => ( {
	type: CONFIGURE_LOCALES,
	defaultLocale,
	supported
} );

export const addOperatorLocale = ( locale, operator_id ) => ( {
	type: ADD_USER_LOCALE, locale, operator_id
} );
