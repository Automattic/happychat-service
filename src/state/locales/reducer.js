import {
	assocPath,
	compose,
	merge,
	path,
	when,
	isEmpty,
	always,
	prepend,
	contains,
	not,
	defaultTo,
	prop,
	both,
	mapObjIndexed,
	assoc
} from 'ramda'
import { combineReducers } from 'redux'

import asString from '../as-string'
import { REMOTE_USER_KEY } from '../middlewares/socket-io/broadcast'
import {
	SET_OPERATOR_CAPACITY,
	JOIN_LOCALE,
	LEAVE_LOCALE,
	CONFIGURE_LOCALES,
	SET_USER_LOADS
} from '../action-types'

// List of locales that operators can choose to support
// to allow support for additional locales they need to
// be provided by the happychat-service user
const supported = ( state = [ 'en-US' ], action ) => {
	switch ( action.type ) {
		case CONFIGURE_LOCALES:
			return compose(
				when(
					both(
						compose( not, isEmpty, always( action.defaultLocale ) ),
						compose( not, contains( action.defaultLocale ) )
					),
					prepend( action.defaultLocale )
				),
				defaultTo( [] ),
				prop( 'supported' )
			)( action )
	}
	return state
}

// The default locale assigned to chats that have none specified
// and by default operators will be assigned to this locale unless
// they explicitly remove themselves
const defaultLocale = ( state = 'en-US', action ) => {
	switch ( action.type ) {
		case CONFIGURE_LOCALES:
			return when( isEmpty, always( state ), action.defaultLocale )
	}
	return state
}

const localeUserPath = action => [
	action.locale,
	asString( action[REMOTE_USER_KEY].id )
]

const DEFAULT_CAPACITY = 3;

const membership = ( state = { capacity: DEFAULT_CAPACITY, load: 0, active: true }, action ) => {
	switch ( action.type ) {
		case JOIN_LOCALE:
			return merge( state, { active: true } )
		case LEAVE_LOCALE:
			return merge( state, { active: false } )
		case SET_OPERATOR_CAPACITY:
			return merge( state, { capacity: parseInt( action.capacity ) } )
	}
	return state
}

// a mapping of locale codes to operator ids
// e.g. { "en-US": { "123456": { capacity, load, active }, "54321": true } }
const memberships = ( state = {}, action ) => {
	switch ( action.type ) {
		case SET_OPERATOR_CAPACITY:
		case JOIN_LOCALE:
		case LEAVE_LOCALE:
			const userPath = localeUserPath( action )
			return assocPath( userPath, membership( path( userPath, state ), action ), state )
		case SET_USER_LOADS:
			// every user that has a load set in the action will
			// have a membership record, so iterating through the current
			// memberships and setting the load should be all that is necessary
			// if a load is present in action.loads but no matching user membership
			// the load will be unused
			return mapObjIndexed( ( members, locale ) =>
				mapObjIndexed( ( memberData, userID ) =>
					assoc(
						'load',
						defaultTo( 0, path( [ 'loads', locale, userID ], action ) ),
						memberData
					)
				)( members )
			)( state )
	}
	return state
}

export default combineReducers( { supported, defaultLocale, memberships } )
