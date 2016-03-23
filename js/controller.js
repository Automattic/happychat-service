'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
var debug = require('debug')('tinkerchat:controller');

// change a lib/customer message to what an agent client expects
var formatAgentMessage = function formatAgentMessage(author_type, author_id, context, _ref) {
	var id = _ref.id;
	var timestamp = _ref.timestamp;
	var text = _ref.text;
	return {
		id: id, timestamp: timestamp, text: text,
		context: context,
		author_id: author_id,
		author_type: author_type
	};
};

exports.default = function (_ref2) {
	var customers = _ref2.customers;
	var agents = _ref2.agents;

	customers.on('message', function (_ref3, message) {
		var id = _ref3.id;

		debug('received customer message', message);
		agents.emit('receive', formatAgentMessage('customer', id, id, message));
	});
	customers.on('join', function () {
		for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
			args[_key] = arguments[_key];
		}

		agents.emit.apply(agents, ['join'].concat(args));
	});
	agents.on('message', function (message) {
		// TODO: send agent message to correct customer room
		debug('received agent message', message);
		customers.emit('receive', Object.assign({}, { author_type: 'agent' }, message));
	});
};