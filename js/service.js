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

var _controller = require('./controller');

var _controller2 = _interopRequireDefault(_controller);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = require('debug')('tinkerchat:main');

exports.default = function (server, _ref) {
	var customerAuthenticator = _ref.customerAuthenticator;
	var agentAuthenticator = _ref.agentAuthenticator;

	debug('configuring socket.io server');
	var io = new _socket2.default(server);

	(0, _controller2.default)({
		customers: (0, _customer2.default)(io.of('/customer')).on('connection', customerAuthenticator),
		agents: (0, _agent2.default)(io.of('/agent')).on('connection', agentAuthenticator)
	});

	return io;
};