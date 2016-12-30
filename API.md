# Happychat service

Exposed by `import service from 'happychat-service'`.

* [service](#service)
* [service.io](#serviceio)
    * [controller events](#controllerevents)
        * [&#8594; log](#log)
    * [/agent events](#agentevents)
        * [&#8592; connection](#connection)
        * [&#8592; message](#message)
        * [&#8592; system.info](#systeminfo)
        * [&#8592; role.add](#role.add)
        * [&#8594; init](#init)
        * [&#8594; unauthorized](#unauthorized)
        * [&#8594; message](#message)
    * [/customer events](#customerevents)
        * [&#8592; connection](#connection)
        * [&#8592; message](#message)
        * [&#8592; typing](#typing)
        * [&#8592; disconnect](#disconnect)
        * [&#8594; init](#init)
        * [&#8594; unauthorized](#unauthorized)
        * [&#8594; accept](#accept)
        * [&#8594; status](#status)
        * [&#8594; typing](#typing)
        * [&#8594; message](#message)
    * [/operator events](#operatorevents)
        * [&#8592; connection](#connection)
        * [&#8592; status](#status)
        * [&#8592; capacity](#capacity)
        * [&#8592; disconnect](#disconnect)
        * [&#8592; message](#message)
        * [&#8592; chat.open](#open)
        * [&#8592; chat.typing](#typing)
        * [&#8592; chat.join](#join)
        * [&#8592; chat.leave](#leave)
        * [&#8592; chat.close](#close)
        * [&#8592; chat.transfer](#transfer)
        * [&#8592; broadcast.state](#broadcaststate)
        * [&#8592; broadcast.dispatch](#broadcastdispatch)
        * [&#8594; init](#init)
        * [&#8594; unauthorized](#unauthorized)
        * [&#8592; broadcast.state](#broadcaststate)
        * [&#8592; broadcast.update](#broadcastupdate)
        * [&#8594; chat.message](#chatmessage)
        * [&#8594; chat.typing](#chattyping)
        * [&#8594; chat.close](#chatclose)

## service

service( server, authenticators, [state], [enhancers] )

* `io` (SocketIO server) server that will manage the messaging between the different actors (customer, operator, and agent).
* `authenticators` (Object)
    * `agentAuthenticator` (Function) authenticator function for agent
    * `customerAuthenticator` (Function) authenticator function for customer
    * `operatorAuthenticator` (Function) authenticator function for operator
* `state` (Object) the initial Redux state
* `enhancers` (Array) contains user provided Redux enhancers to be passed to the [createStore](http://redux.js.org/docs/api/createStore.html) function.

Returns an Object that contains:

* `io` the SocketIO server.
* `controller`
* `store`
* `configureLocales`

## service.io

The server SocketIO. It defines three different namespaces beyond the default one:

* `/`
* `/agent`
* `/customer`
* `/operator`

### Controller events

#### log

&#8594; Fired upon customer joins.

handleCustomerJoin.

Args:

* `messages`

&#8594; Fired upon operator joins.

Args:

* `chat_id`
* `message`

### Agent events

#### connection

&#8592; Received upon client connection to `/agent` namespace.

Args:

* `socket` (socketio.Socket) client that connected.

#### message

&#8592; Received upon agent sends a message.

Args:

* `message`

#### system.info

&#8592; Received upon agent sends a message.

Args:

* `callback` (Function)

#### role.add

&#8592; Received upon agent joins a role.

Args:

* `role` role to join.
* `callback` (Function)

#### init

&#8594; Fired upon successful client authentication.

Args:

* `user` (Object) user data.

#### unauthorized

&#8594; Fired upon failed client authentication.

Args:

* none

#### message

&#8594; Fired upon agent receives a message.

Args:

* `message`

### Customer events

#### connection

&#8592; Received upon client connection to `/customer` namespace.

Args:

* `socket` (socketio.Socket) user that connected.

#### message

&#8592; Received upon client sends a message.

Args:

* `message` (Object)
    * `text` the message being sent.
    * `id`
    * `meta`

#### typing

&#8592; Received upon client is typing.

Args:

* `text` message.

#### disconnect

&#8592; Received upon client has disconnected.

Args:

* none

#### init

&#8594; Fired upon successful client authentication.

Args:

* `user` (Object) user data.

#### unauthorized

&#8594; Fired upon failed client authentication.

Args:

* none

#### accept

&#8594; Fired upon status change notification.
handleCustomerJoin

Args:

* `status` (Boolean) true if system accepts new chats and have operator available; false otherwise.

#### status

&#8594; Fired upon status changed or customer joining a chat.

Args:

* `status` the status of chat. One of `STATUS_NEW`, `STATUS_PENDING`, `STATUS_MISSED`, `STATUS_ASSIGNED`, `STATUS_ASSIGNING`, `STATUS_ABANDONED`, `STATUS_CUSTOMER_DISCONNECT`, `STATUS_CLOSED`.

#### typing

&#8594; Fired upon client received typing.

Args:

* `text` true if text received is not empty, the own text otherwise.

#### message

&#8594; Fired upon client received message.

Args:

* `message` the message sent.

### Operator events

#### connection

&#8592; Received upon client connection to `/operator` namespace.

Args:

* `socket` (socketio.Socket) user that connected.

#### status

&#8592; Received upon client set status.

Args:

* `status` the new operator status.
* `done` (Function) callback.

#### capacity

&#8592; Received upon client set capacity.

Args:

* `capacity` the new operator capacity.
* `done` (Function) callback, will receive the capacity as arg.

#### disconnect

&#8592; Received upon client disconnection.

Args:

* none

#### message

&#8592; Received upon client send a message.

Args:

* `chat_id` chat unique identifier.
* `message` (Object)
    * `id` message id
    * `text` message text

#### chat.open

&#8592; Received upon client opened chat.

Args:

* `chat_id` chat unique identifier.

#### chat.typing

&#8592; Received upon client started to type.

Args:

* `chat_id` chat unique identifier.
* `text` message text

#### chat.join

&#8592; Received upon client joined a chat.

Args:

* `chat_id` chat unique identifier.

#### chat.leave

&#8592; Received upon client left a chat.

Args:

* `chat_id` chat unique identifier.

#### chat.close

&#8592; Received upon client closed a chat.

Args:

* `chat_id` chat unique identifier.

#### chat.transfer

&#8592; Received upon client transfered a chat.

Args:

* `chat_id` chat unique identifier.
* `user_id` operator that will receive the transfer.

#### broadcast.state

&#8592; Received upon operator is ready.

Args:

* `callback` (Function) function to call on event; it receives as args:

    * `version`
    * `currentState`

#### broadcast.dispatch

&#8592; Received upon client wants to dispatch a remote action over SocketIO.

Args:

* `callback` (Function) function to call on event; it receives as args:

    * `remoteAction`
    * `callback` (Function) function to call upon completion of the remote action.

#### init

&#8594; Fired upon successful client authentication.

Args:

* `user` (Object) user data.

#### unauthorized

&#8594; Fired upon failed client authentication.

Args:

* none

#### broadcast.state

&#8594; Fired upon operator is ready.

Args:

* `version`
* `currentState`

#### broadcast.update

&#8594; Fired upon state changed.

Args:

* `version`
* `nextVersion`
* `patch`

#### chat.message

&#8594; Fired upon operator receives message.

Args:

* `chat_id` (Object)
* `id` chat unique identifier
* `message`

#### chat.typing

&#8594; Fired upon operator receives typing.

Args:

* `chat_id` chat unique identifier
* `user_id`
* `text` message being sent

#### chat.close

&#8594; Fired upon operator closes chat or customer disconnects.

Args:

* `chat_id` chat unique identifier
* `operator`
