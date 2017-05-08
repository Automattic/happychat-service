# Socket-IO Redux Middlewares

A collection of middlewares that work with redux to support socket-io clients.

## Operator

Handles Socket-IO client connections to the `/operator` namespace and provides
the interface to allow operator to send and receive chat messages.

## Chatlist

Allows customers to be added to the support queue and sends and receives chat
messages to customer socket-io clients.

## Agents

Allows connections from third parties to receive all messages in the system and
send chat messages to any chat in the system.