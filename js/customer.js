'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _events = require('events');

var _util = require('./util');

var debug = require('debug')('tinkerchat:customer');

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

var identityForUser = function identityForUser(_ref2) {
	var id = _ref2.id;
	var displayName = _ref2.displayName;
	var avatarURL = _ref2.avatarURL;
	return { id: id, displayName: displayName, avatarURL: avatarURL };
};

var timestamp = function timestamp() {
	return Math.ceil(new Date().getTime() / 1000);
};

/**
  - `user`: (**required**) a JSON key/value object containing:
    - `id`: (**required**) the unique identifier for this user in the *Support Provider*'s system
    - `username`: (**required**) an account name for the user
    - `displayName`: (**required**) name to use in application UI
    - `avatarURL`: (**required**) URL to image to display as user's avatar
    - `tags`: Array of strings to identify the user (example: `['premium', 'expired']`)
 */

var init = function init(_ref3) {
	var user = _ref3.user;
	var socket = _ref3.socket;
	var events = _ref3.events;
	var io = _ref3.io;
	return function () {
		var socketIdentifier = { id: user.id, socket_id: socket.id };
		debug('user joined room', user.id);

		socket.on('message', function (_ref4) {
			var text = _ref4.text;
			var id = _ref4.id;

			var meta = {};
			var userIdentity = identityForUser(user);
			var message = { id: id, text: text, timestamp: timestamp(), user: userIdentity, meta: meta };
			// all customer connections for this user receive the message
			debug('broadcasting message', user.id, id, text);
			io.to(user.id).emit('message', message);
			events.emit('message', formatAgentMessage('customer', user.id, user.id, message));
		});

		socket.on('disconnect', function () {
			return events.emit('leave', socketIdentifier);
		});
		events.emit('join', socketIdentifier);
		socket.emit('init', user);
	};
};

var join = function join(_ref5) {
	var events = _ref5.events;
	var io = _ref5.io;
	var user = _ref5.user;
	var socket = _ref5.socket;

	debug('user joined', user.username, user.id);

	// user joins room based on their identifier
	socket.join(user.id, init({ user: user, socket: socket, events: events, io: io }));
};

exports.default = function (io) {
	var events = new _events.EventEmitter();

	events.on('receive', function (message) {
		var context = message.context;
		var user = message.user;

		io.to(context).emit('message', message);
		debug('send from', user);
		// events.emit( 'receive', formatAgentMessage( 'agent', user.id, context, message ) )
	});
	io.on('connection', function (socket) {
		debug('customer connecting');
		(0, _util.onConnection)({ socket: socket, events: events })(function (user) {
			return join({ socket: socket, events: events, user: user, io: io });
		});
	});
	return events;
};