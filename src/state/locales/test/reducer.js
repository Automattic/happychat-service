/**
 * External dependencies
 */
import { deepEqual } from 'assert'
import { createStore } from 'redux'

/**
 * Internal dependencies
 */
import { configureLocales } from 'src/state/locales/actions'
import { setUserLoads } from 'src/state/operator/actions'
import reducer from 'src/state/locales/reducer'

describe( 'Locale reducer', () => {
	it( 'should have default state', () => {
		const store = createStore( reducer )
		deepEqual( store.getState(), {
			defaultLocale: 'en-US',
			supported: [ 'en-US' ],
			memberships: {}
		} )
	} )

	it( 'should configure locales', () => {
		const store = createStore( reducer )
		store.dispatch( configureLocales( 'fr', [ 'en-US' ] ) )
		deepEqual( store.getState(), {
			defaultLocale: 'fr',
			supported: [ 'fr', 'en-US' ],
			memberships: {}
		} )
	} )

	it( 'should add default if no supported locales', () => {
		const store = createStore( reducer )
		store.dispatch( configureLocales( 'en' ) )
		deepEqual( store.getState().supported, [ 'en' ] )
	} )

	it( 'should not change supported when default is present', () => {
		const store = createStore( reducer )
		store.dispatch( configureLocales( 'en', [ 'fr', 'en' ] ) )
		deepEqual( store.getState().supported, [ 'fr', 'en' ] )
	} )

	it( 'should set operator loads per locale', () => {
		const store = createStore( reducer, {
			memberships: {
				en: {
					usera: { load: 0, capacity: 1, active: true },
					userb: { load: 1, capacity: 2, active: false }
				}
			}
		} )
		store.dispatch( setUserLoads( { en: { usera: 1 } } ) )
		deepEqual(
			store.getState().memberships,
			{ en: {
				usera: { load: 1, capacity: 1, active: true },
				userb: { load: 0, capacity: 2, active: false }
			} }
		)
	} )
} )
