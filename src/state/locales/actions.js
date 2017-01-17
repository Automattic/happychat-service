import { CONFIGURE_LOCALES } from '../action-types'

export const configureLocales = ( defaultLocale, supported ) => ( {
	type: CONFIGURE_LOCALES,
	defaultLocale,
	supported
} )
