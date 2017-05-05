# System 

These middlewares do not rely on socket-io to function. The more application
logic that can be added here the less dependendent the system is on socket-io
to function.

## Utilities

### Event Message

Creates a message for operators to notify of events related to the chat (e.g. operator joining, customer disconnecting).

### Handlers

Higher order functions for redux middlewares.

## Redux Middlewares

### Chat Assignment

Assigns customer chats to available operators. Action type handlers:

- `ASSIGN_NEXT_CHAT`: picks and assigns next chat to assign
- `ASSIGN_CHAT`: picks an operator to assign to the chat, in no operator available marks the chat is missed
- `NOTIFY_SYSTEM_STATUS_CHANGE`: when operator availability changes, marks all missed chats that can now be assigned as pending
- `CUSTOMER_INBOUND_MESSAGE`: when a message is sent by the customer, checks chat status and wether it should be assigned based one existing chat status

### Chat Status Notifier

Monitors chat statuses and dispatches an action no notify a chat when its status
changes. `middlewares/socket-io/chatlist` uses this to notify connected chats
of their status.

### Controller

Receives all messages from connected clients and:

1. Runs application middlewares on the messages
2. Caches messages in memory
3. Dispatches the transformed messages to be delivered to correct clients

### Customer Presence

Handle customer connecting and disconnecting from chats:

- `CUSTOMER_JOIN`: Checks status of chat and adds it to chatlist if necessary, reconnects customer to previously assigned operator if the customer is returning from being disconnected. Clears timers for automated disconnect dispatches
- `CUSTOMER_DISCONNECT`: When customer completely disconnects before chat is closed, sets timers to close the chat and notify operators with a message

### Event Messages

Sends event messages to chat operators when certain events occur:

- `CUSTOMER_LEFT`
- `CLOSE_CHAT`
- `SET_CHAT_OPERATOR`
- `OPERATOR_CHAT_JOIN`
- `OPERATOR_CHAT_LEAVE`
- `AUTOCLOSE_CHAT`

### Load Updater

Watches for actions that change which operators have joined a chat and set the
correct load numbers for each operator in each locale they are a member of.

### Operator Default Group

Sets an operator's group assignment to the default group if the operator is not a member of any group during the `OPERATOR_READY` action type.

### System Status Notifier

Watches for actions that change the total capacity of chats and dispatches an
action when the availability of any chat locale changes.

`middlewares/socket-io/chatlist` uses this information to let connected
customers if they can open a new chat.

### Transfer Chat

Sets the new chat operator when a chat transfer is requested and generates an event message for operators.

