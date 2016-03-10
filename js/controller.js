'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
var debug = require('debug')('tinkerchat:controller');

exports.default = function (_ref) {
	var customers = _ref.customers;
	var agents = _ref.agents;

	customers.on('message', function (message) {
		debug('received customer message', message);
		agents.emit('receive', message);
	});
	agents.on('message', function (message) {
		debug('received agent message', message);
		customers.emit('receive', message);
	});
};