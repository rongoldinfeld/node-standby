# Node Standby

![npm version](https://img.shields.io/npm/v/node-standby.svg)
![npm downloads](https://img.shields.io/npm/dm/node-standby.svg)

Node Standby is a lightweight library for managing distributed locks in Node.js. It is especially useful in scenarios where a task needs to be performed only once, and multiple instances of the same service are running in parallel. With Node Standby, you can ensure that only one instance of a service runs a specific task at any given time, even in a clustered environment.

## Features

- Provides distributed locking to ensure that a specific task is performed by only one instance of a service at any given time.
- Lightweight and easy-to-use API.
- Provides robust error handling and logging.

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

- `name`: the name of the task. This can be a string or a function that returns a string.
- `pollingIntervalSeconds`: the interval at which the status of the task is checked, in seconds.
- `ttlSeconds`: the time to live (TTL) for the task, in seconds.

## How It Works

Node Standby works by using Redis to create a distributed lock for a specific task. When a service starts, it checks the status of the task in Redis. If the task is not being performed by another instance of the service, the service sets the status of the task to "active" and performs the task. If the task is already being performed by another instance of the service, the service sets the status of the task to "waiting" and waits for the other instance to finish the task.

Node Standby uses a polling mechanism to check the status of the task in Redis. This ensures that the status of the task is updated in a timely manner, and that the service can take action accordingly.

## License

Node Standby is licensed under the [MIT License](LICENSE).