import { path, defaultTo, compose, prop, find, equals, not, isNil, values } from 'ramda';

import { DEFAULT_GROUP_ID } from './reducer';
import asString from '../as-string';
import { getDefaultLocale } from '../locales/selectors';

export { DEFAULT_GROUP_ID };
export const getGroups = prop( 'groups' );

export const getGroup = ( groupID, state ) => compose(
	defaultTo( {} ),
	path( [ 'groups', groupID ] )
)( state );

export const makeLocaleGroupToken = ( locale, group ) => `${ locale }-${ group }`;

export const getDefaultGroup = state => getGroup( DEFAULT_GROUP_ID, state );

export const getDefaultLocaleGroup = state => {
	const group = getDefaultGroup( state );
	const locale = getDefaultLocale( state );
	return makeLocaleGroupToken( locale, prop( 'id', group ) );
};

export const isOperatorMemberOfAnyGroup = ( userId, state ) => compose(
	// find the first group the sure might be a memebr of
	compose( not, isNil ),
	find( compose(
		equals( true ),
		path( [ 'members', asString( userId ) ] ),
	) ),
	values,
	getGroups
)( state );
