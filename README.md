# Node Standby

[![npm version](https://img.shields.io/npm/v/node-standby.svg)](https://www.npmjs.com/package/node-standby)
[![npm downloads](https://img.shields.io/npm/dm/node-standby.svg)](https://www.npmjs.com/package/node-standby)

`node-standby` is a library that aims to ensure continuous uptime of processes that should be running all the time. This is achieved by enabling two instances to be up and running simultaneously, while only one instance is actively processing. In case of a failure, the standby instance will take over, minimizing downtime until the failed instance can be replaced

## Features

- Enables a process to keep running even if one node instance is down, minimizing downtime.
- Provides a simple and efficient way to implement a standby mechanism, ensuring that there is always a backup instance ready to take over in case of failure.
- Supports multiple instances running concurrently, with only one active at a time, and automatic failover when the active instance goes down.
- Uses Redis as a shared storage to store the state of the standby mechanism, ensuring consistency and availability across multiple processes and nodes.

## Installation

To install Node Standby, simply run the following command:

```sh
npm install node-standby
```

## Usage

Here's an example of how to use Node Standby to ensure that only one instance of a service performs a specific task:

```ts
const redis = require('redis');
const client = redis.createClient();

const standby = require('node-standby').standby;

const myTask = () => {
  // Perform the task here
};

standby(client, myTask, { name: 'my-task' });
```

In this example, `standby` is called with three arguments:

1. `client`: a Redis client instance.
2. `myTask`: the task to be performed.
3. `options`: an object containing options for the standby function.

The `options` object can have the following properties:

- `name`: the name of the task. This can be a string or a function that returns a string (Representing the key in Redis).
- `pollingIntervalMS`: the interval at which the status of the task is checked, in milli seconds.
- `ttlMS`: the time to live (TTL) for the task, in milli seconds.

## How It Works

The `node-standby` library provides a simple but effective way to ensure that a process keeps running even if one instance is down. The library works by using Redis as a shared storage to store the state of the standby mechanism.

When the process starts, it creates a unique identifier (a UUID) that identifies this instance. It then starts a timer that periodically checks the status of the mechanism. If the mechanism is waiting or the current active instance has expired, the timer sets the status to active and starts running the process. If the mechanism is already active, the timer checks if the current active instance is this one. If it is, the timer simply resets the expiration time. If it's not, the timer goes back to sleep until the next interval.

If the active instance fails, the next timer that wakes up will detect this and set the status to waiting, effectively triggering a failover. The next timer that wakes up will then become the new active instance and start running the process.

By using Redis as a shared storage, the node-standby library ensures consistency and availability across multiple processes and nodes, making it a robust and scalable solution for implementing standby mechanisms in Node.js applications.

## License

Node Standby is licensed under the [MIT License](LICENSE).