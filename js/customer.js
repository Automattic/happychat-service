'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _uuid = require('uuid');

var _events = require('events');

var debug = require('debug')('tinkerchat:customer');

var identityForUser = function identityForUser(_ref) {
	var id = _ref.id;
	var displayName = _ref.displayName;
	var avatarURL = _ref.avatarURL;
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

/**
  - `user`: (**required**) a JSON key/value object containing:
    - `id`: (**required**) the unique identifier for this user in the *Support Provider*'s system
    - `username`: (**required**) an account name for the user
    - `displayName`: (**required**) name to use in application UI
    - `avatarURL`: (**required**) URL to image to display as user's avatar
    - `tags`: Array of strings to identify the user (example: `['premium', 'expired']`)
 */
var join = function join(_ref2) {
	var user = _ref2.user;
	var socket = _ref2.socket;
	var events = _ref2.events;

	debug('user joined', user.username, user.id);
	var userIdentity = identityForUser(user);
	socket.on('message', function (text) {
		var meta = {};
		var message = { id: (0, _uuid.v4)(), text: text, timestamp: timestamp(), user: userIdentity, meta: meta };
		socket.emit('message', message);
		events.emit('message', message);
	});

	socket.emit('init', user);
};

var onToken = function onToken(_ref3) {
	var authenticator = _ref3.authenticator;
	var socket = _ref3.socket;
	var events = _ref3.events;
	return function (token) {
		debug('authenticating user');
		authenticate(authenticator, token).then(function (user) {
			return join({ user: user, socket: socket, events: events });
		}).catch(function () {
			socket.emit('unauthorized');
			socket.close();
		});
	};
};

var onConnection = function onConnection(_ref4) {
	var authenticator = _ref4.authenticator;
	var events = _ref4.events;
	return function (socket) {
		socket.on('token', onToken({ authenticator: authenticator, socket: socket, events: events }));
		// ask connection for token
		socket.emit('token');
	};
};

exports.default = function (io, authenticator) {
	var events = new _events.EventEmitter();
	io.on('connection', onConnection({ authenticator: authenticator, events: events }));
	return events;
};