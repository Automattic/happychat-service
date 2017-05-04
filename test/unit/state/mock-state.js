import { STATUS_ASSIGNED, STATUS_CLOSED } from 'state/chatlist/reducer';
import groups from 'state/groups/reducer';
import locales from 'state/locales/reducer';

export const onlineOperatorID = 'operator-1';
export const transferOnlyOperatorID = 'operator-transfer';
export const assignedChatID = 'chat-1';
export const closedChatID = 'closed-chat-2';

export const onlineOperator = { id: onlineOperatorID };
export const transferOnlyOperator = { id: transferOnlyOperatorID };
export const assignedChat = { id: assignedChatID, session_id: assignedChatID };
export const closedChat = { id: closedChatID, session_id: closedChatID };

export const state = {
	chatlist: {
		[ assignedChatID ]: [
			STATUS_ASSIGNED,
			assignedChat,
			onlineOperator,
			1,
			{ [ onlineOperatorID ]: true, [ transferOnlyOperatorID ]: true },
			null,
			null
		],
		[ closedChatID ]: [
			STATUS_CLOSED,
			closedChat,
			onlineOperator,
			1,
			{ [ onlineOperatorID ]: true },
			null,
			null
		]
	},
	operators: {
		identities: {
			[ onlineOperatorID ]: onlineOperator,
			[ transferOnlyOperatorID ]: transferOnlyOperator
		}
	},
	locales: locales( undefined, { type: null } ),
	groups: groups( undefined, { type: null } )
};
