# Authentication

`happychat-service` instances need to provide authentication functions for the different roles, which will be fired when the SocketIO client connects to the SocketIO server.

An authenticator function has the following signature:

    authenticator( socket, callback( error, result ))

Where:

* `socket` is a reference to the SocketIO client that started the auth process.
* `callback` is the function to call on completion.
* `error` should be a truthy value when the authentication fails, and falsy otherwise.
* `result` should be an user object if the auth succeeds. It will be ignored otherwise.

`happychat-service` will also check that the result of the authentication process is an object containing certain keys.

The [required keys](src/service.js#13) for the operator are:

* `id`
* `username`
* `displayName`
* `picture`

The [required keys](src/service.js#14) for the customer are:

* `id`
* `username`
* `displayName`
* `picture`
* `session_id`


The result of the agent authenticator requires no special keys.
