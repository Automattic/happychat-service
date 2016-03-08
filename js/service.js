'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _socket = require('socket.io');

var _socket2 = _interopRequireDefault(_socket);

var _customer = require('./customer');

var _customer2 = _interopRequireDefault(_customer);

var _agent = require('./agent');

var _agent2 = _interopRequireDefault(_agent);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (server, _ref) {
	var customerAuthenticator = _ref.customerAuthenticator;
	var agentAuthenticator = _ref.agentAuthenticator;

	var service = new _socket2.default(server);
	var customers = (0, _customer2.default)(service.of('/customer'), customerAuthenticator);
	(0, _agent2.default)(service.of('/agent'), { customers: customers, authenticator: agentAuthenticator });
	return service;
};