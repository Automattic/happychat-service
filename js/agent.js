'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _events = require('events');

var _util = require('./util');

var debug = require('debug')('tinkerchat:agent');

var onAuthorized = function onAuthorized(_ref) {
	var socket = _ref.socket;
	var events = _ref.events;
	return function (agent) {
		// any message sent from a customer needs to be forwarded to the agent socket
		/**
  `message`: A message being sent and the context of the message
   - `id`: the id of the message
   - `chat_id`: the conversation this message is for
   - `timestamp`: timestampe of the message
   - `text`: content of the message
   - `context`: the id of the channel the message was sent to
   - `author_id`: the id of the author of the message
   - `author_type`: One of `customer`, `support`, `agent`
   */
		events.on('receive', function (message) {
			return socket.emit('message', message);
		});
		socket.on('message', function (message) {
			// TODO: validate message
			events.emit('message', message);
		});
		socket.emit('init', agent);
	};
};

exports.default = function (io) {
	var events = new _events.EventEmitter();

	io.on('connection', function (socket) {
		debug('connection');
		(0, _util.onConnection)({ socket: socket, events: events })(function () {
			return onAuthorized({ socket: socket, events: events })();
		});
	});
	return events;
};