/**
 * External dependencies
 */
import { deepEqual, equal } from 'assert'

/**
 * Internal dependencies
 */
import { SET_USER_LOADS } from 'src/state/action-types'
import middleware from 'src/state/middlewares/system/load-updater'
import { operatorChatJoin } from 'src/state/operator/actions'
import { STATUS_ASSIGNED } from 'src/state/chatlist/reducer'

describe( 'Operator loads', () => {
	const next = v => v

	it( 'should update operator loads per locale', () => {
		let dispatchedAction
		const updater = middleware( {
			getState: () => ( {
				locales: { defaultLocale: 'en', supported: [ 'en', 'fr' ] },
				chatlist: {
					chat1: [
						STATUS_ASSIGNED, // chat status
						{ id: 'chat1' }, // chat details
						{}, // assigned operator, doesn't matter in this context
						1, // timestamp for chat
						{ op1: true, op2: true } // operators in the chat
					],
					chat2: [
						STATUS_ASSIGNED,
						{ id: 'chat2' },
						{},
						1,
						{ op1: true },
						'fr'
					]
				}
			} ),
			dispatch: dispatched => dispatchedAction = dispatched
		}
		)( next )

		const action = operatorChatJoin()
		const result = updater( action )

		deepEqual( result, action )
		equal( dispatchedAction.type, SET_USER_LOADS )
		deepEqual( dispatchedAction.loads, {
			en: { op1: 1, op2: 1 },
			fr: { op1: 1 }
		} )
	} )
} )
