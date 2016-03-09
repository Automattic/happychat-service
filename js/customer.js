'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _events = require('events');

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

var authenticate = function authenticate(authenticator, token) {
	return new Promise(function (resolve, reject) {
		authenticator(token, function (e, user) {
			if (e) return reject(e);
			resolve(user);
		});
	});
};

var init = function init(_ref3) {
	var user = _ref3.user;
	var socket = _ref3.socket;
	var events = _ref3.events;
	var io = _ref3.io;
	return function () {
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
			events.emit('receive', formatAgentMessage('customer', user.id, user.id, message));
		});

		socket.emit('init', user);
	};
};

/**
  - `user`: (**required**) a JSON key/value object containing:
    - `id`: (**required**) the unique identifier for this user in the *Support Provider*'s system
    - `username`: (**required**) an account name for the user
    - `displayName`: (**required**) name to use in application UI
    - `avatarURL`: (**required**) URL to image to display as user's avatar
    - `tags`: Array of strings to identify the user (example: `['premium', 'expired']`)
 */
var join = function join(_ref5) {
	var user = _ref5.user;
	var socket = _ref5.socket;
	var events = _ref5.events;
	var io = _ref5.io;

	debug('user joined', user.username, user.id);

	// user joins room based on their identifier
	socket.join(user.id, init({ user: user, socket: socket, events: events, io: io }));
};

var onToken = function onToken(_ref6) {
	var authenticator = _ref6.authenticator;
	var socket = _ref6.socket;
	var events = _ref6.events;
	var io = _ref6.io;
	return function (token) {
		debug('authenticating user');
		authenticate(authenticator, token).then(function (user) {
			return join({ user: user, socket: socket, events: events, io: io });
		}).catch(function (e) {
			debug('unauthorized customer', e);
			socket.emit('unauthorized');
			socket.close();
		});
	};
};

var onConnection = function onConnection(_ref7) {
	var authenticator = _ref7.authenticator;
	var events = _ref7.events;
	var io = _ref7.io;
	return function (socket) {
		socket.on('token', onToken({ authenticator: authenticator, socket: socket, events: events, io: io }));
		// ask connection for token
		socket.emit('token');
	};
};

exports.default = function (io, authenticator) {
	var events = new _events.EventEmitter();
	events.on('send', function (message) {
		var context = message.context;
		var user = message.user;

		io.to(context).emit('message', message);
		debug('send from', user);
		events.emit('receive', formatAgentMessage('agent', user.id, context, message));
	});
	io.on('connection', onConnection({ authenticator: authenticator, events: events, io: io }));
	return events;
};