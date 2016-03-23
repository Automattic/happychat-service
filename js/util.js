'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
var debug = require('debug')('tinkerchat:util');

var asCallback = function asCallback(_ref) {
	var resolve = _ref.resolve;
	var reject = _ref.reject;
	return function (error, result) {
		if (error) return reject(error);
		resolve(result);
	};
};

var connect = function connect(_ref2) {
	var events = _ref2.events;
	var socket = _ref2.socket;
	return new Promise(function (resolve, reject) {
		events.emit('connection', socket, asCallback({ resolve: resolve, reject: reject }));
	});
};

var rejectAndClose = function rejectAndClose(socket) {
	return function (e) {
		debug('closing socket', e);
		socket.emit('unauthorized');
		socket.close();
	};
};

var onConnection = exports.onConnection = function onConnection(_ref3) {
	var events = _ref3.events;
	var socket = _ref3.socket;
	return function (success) {
		return connect({ events: events, socket: socket }).then(success, rejectAndClose(socket));
	};
};