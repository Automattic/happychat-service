# Tinkerchat Chat Server

Socket.IO based chat server for tinkerchat.

In progress implementation of [Tinkerchat Service][].

[Tinkerchat Service]: http://github.com/Automattic/tinkerchat/blob/master/SERVICE.md

## Developing

This is in the early stages, all development is being done TDD style.

```
node --version
v5.7.1
```

1. `git clone git@github.com:automattic/tinkerchat-service.git`
2. `cd tinkerchat-service`
3. `npm install`
4. `npm test`

```
> tinkerchat-service@0.0.1 test /Users/beaucollins/code/tinkerchat-service
> `npm bin`/mocha --compilers js:babel-register --recursive



  customer service

    ✓ should allow connections

    ✓ should request a token

    ✓ should authenticate and init client

    ✓ should fail to authenticate with invalid token
    with authorized user

      ✓ should receive message and broadcast it


  5 passing (130ms)

```