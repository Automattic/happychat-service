# System Redux Middlewares

These middlewares do not rely on socket-io to function. The more application
logic that can be added here the less dependendent the system is on socket-io
to function.


## Chat Status Notifier

Monitors chat statuses and dispatches an action no notify a chat when its status
changes. `middlewares/socket-io/chatlist` uses this to notify connected chats
of their status.

## Load Updater

Watches for actions that change which operators have joined a chat and set the
correct load numbers for each operator in each locale they are a member of.

## System Status Notifier

Watches for actions that change the total capacity of chats and dispatches an
action when the availability of any chat locale changes.

`middlewares/socket-io/chatlist` uses this information to let connected
customers if they can open a new chat.

## Controller

Receives all messages from connected clients and:

1. Runs application middlewares on the messages
2. Caches messages in memory
3. Dispatches the transformed messages to be delivered to correct clients