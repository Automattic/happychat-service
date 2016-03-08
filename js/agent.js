'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
var authenticate = function authenticate(_ref) {
	var authenticator = _ref.authenticator;
	return new Promise(function (resolve, reject) {
		authenticator(function (error, agent) {
			if (error) return reject(error);
			resolve(agent);
		});
	});
};

// change a lib/customer message to what an agent client expects
var formatCustomerMessage = function formatCustomerMessage(_ref2) {
	var id = _ref2.id;
	var timestamp = _ref2.timestamp;
	var text = _ref2.text;
	var user = _ref2.user;
	return {
		id: id, timestamp: timestamp, text: text,
		context: user.id,
		author_id: user.id,
		author_type: 'customer'
	};
};

var onAuthorized = function onAuthorized(_ref3) {
	var socket = _ref3.socket;
	var customers = _ref3.customers;
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
		customers.on('message', function (message) {
			return socket.emit('message', formatCustomerMessage(message));
		});
		socket.emit('init', { agent: agent });
	};
};

var onConnection = function onConnection(_ref4) {
	var authenticator = _ref4.authenticator;
	var customers = _ref4.customers;
	return function (socket) {
		authenticate({ authenticator: authenticator }).then(onAuthorized({ socket: socket, customers: customers })).catch(function () {
			socket.emit('unauthorized');
			socket.close();
		});
	};
};

exports.default = function (io, _ref5) {
	var customers = _ref5.customers;
	var authenticator = _ref5.authenticator;
	return io.on('connection', onConnection({ authenticator: authenticator, customers: customers }));
};