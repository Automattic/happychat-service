/**
 * Schemas for `chatlist` reducer
 */

export const chatStatus = { type: 'string' };
export const chatSession = {
	type: 'object',
	required: [ 'user_id', 'id' ],
	properties: {
		'user_id': { type: [ 'number', 'string' ] },
		'id': { type: [ 'number', 'string' ] },
		'username': { type: 'string' },
		'name': { type: 'string' },
		'picture': { type: 'string' },
		'locale': { type: 'string' }
	},
	additionalProperties: true,
};
export const assignedOperator = {
	type: [ 'null', 'object' ],
	required: [ 'id', 'status', 'capacity', 'load', 'active' ],
	properties: {
		online: { type: 'boolean' },
		id: { type: [ 'number', 'string' ] },
		requestingChat: { type: 'boolean' },
		username: { type: 'string' },
		displayName: { type: 'string' },
		picture: { type: 'string' },
		capacity: { type: 'number' },
		load: { type: 'number' },
		active: { type: 'boolean' },
	},
	additionalProperties: true,
};
export const timestamp = { type: 'number' };

// Operator list is a map of operator_id: bool of operators in the chat
export const operatorList = { type: 'object', additionalProperties: { type: 'boolean' } };

export const locale = { type: 'string' }
export const groups = { type: [ 'null', 'array'] }

// A chat is a tuple (using a JS array)
export const chat = {
	required: true,
	type: 'array',
	items: [
		chatStatus,
		chatSession,
		assignedOperator,
		timestamp,
		operatorList,
		locale,
		groups,
	],
	additionalItems: false,
}