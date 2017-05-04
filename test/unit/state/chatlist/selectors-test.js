import { deepEqual } from 'assert';
import {
	getChatsForOperator,
	getOpenChatsForOperator,
	getChatMemberIdentities,
	getOpenChatMembers
} from 'state/chatlist/selectors';
import {
	getDefaultLocale
} from 'state/locales/selectors';

import {
	state,
	onlineOperatorID,
	assignedChat,
	closedChat,
	assignedChatID,
	onlineOperator,
	transferOnlyOperator
} from '../mock-state';

describe( 'state/chatlist/selectors', () => {
	it( 'getChatsForOperator', () => {
		deepEqual(
			getChatsForOperator( onlineOperatorID, state ),
			[ assignedChat, closedChat ]
		);
		deepEqual(
			getChatsForOperator( 'none', state ),
			[]
		);
	} );

	it( 'getOpenChatsForOperator', () => {
		deepEqual(
			getOpenChatsForOperator( onlineOperatorID, state ),
			[ assignedChat ]
		);
	} );

	it( 'getChatMemberIdentities', () => {
		deepEqual(
			getChatMemberIdentities( assignedChatID, state ),
			[ onlineOperator, transferOnlyOperator ]
		);
	} );

	it( 'getOpenChatMembers', () => {
		deepEqual(
			getOpenChatMembers( state ),
			{ [ getDefaultLocale( state ) ]: [ {
				[ onlineOperator.id ]: true,
				[ transferOnlyOperator.id ]: true
			} ] }
		);
	} );

	it( 'getAllChats' );
	it( 'getChatsWithStatus' );
	it( 'getChatsWithStatuses' );
	it( 'getAllNewChats' );
	it( 'getAllMissedChats' );
	it( 'getOperatorAbandonedChats' );
	it( 'getAbandonedChats' );
	it( 'getChatOperator' );
	it( 'getChat' );
	it( 'getChatStatus' );
	it( 'isChatStatusNew' );
	it( 'isChatStatusClosed' );
	it( 'isChatStatusAssigned' );
	it( 'isAssigningChat' );
	it( 'getChatLocale' );
	it( 'getChatGroups' );
	it( 'getAllAssignableChats' );
	it( 'haveAssignableChat' );
	it( 'getNextAssignableChat' );
	it( 'getClosedChatsOlderThan' );
} );
