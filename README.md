# Node Standby - Leader Election using ZooKeeper

[![npm version](https://img.shields.io/npm/v/node-standby.svg)](https://www.npmjs.com/package/node-standby)
[![npm downloads](https://img.shields.io/npm/dm/node-standby.svg)](https://www.npmjs.com/package/node-standby)

Node Standby is a lightweight library for implementing leader election using ZooKeeper in Node.js applications. It provides an easy way to elect a leader among a group of processes and handle leader failures efficiently. With Node Standby, you can ensure high availability and fault tolerance in your distributed systems, minimizing downtime for critical processes.

## Why Use Node Standby?

- **Simplified Leader Election**: Node Standby simplifies the process of leader election by handling the complexity of ZooKeeper interactions. You can focus on your application logic while Node Standby takes care of the underlying coordination.

- **Efficient Failure Handling**: Node Standby minimizes the "herd effect" by watching the next znode down the sequence, avoiding unnecessary notifications and load on the ZooKeeper servers. This ensures efficient leader election without overwhelming the system.

- **Seamless Integration**: Node Standby integrates seamlessly with your existing Node.js applications. It leverages the popular `node-zookeeper-client` library and provides a clean API for leader election, allowing you to easily incorporate it into your projects.

## Installation

Node Standby can be installed via npm:

```bash
npm install node-standby
```

## Usage

```typescript
import { ZooKeeperClient } from 'node-zookeeper-client';
import { registerForLeaderElection } from 'node-standby';

// Create a ZooKeeper client instance
const client = new ZooKeeperClient('zookeeper-server:2181');

// Define the callback function to be executed when elected as the leader
function leaderCallback(sequence) {
    // Your leader logic here
    console.log(`I am the leader! Sequence: ${sequence}`);
}

// Register for leader election using Node Standby
client.once('connected', () => {
    standby({
        // node-zookeeper-client client
        client: client, 
        // the callback to be executed when the leader is elected */
        callback: leaderCallback,
        // represents the number of session timeouts a process can endure before being considered inactive
        // it is recommended to set threshold to a number below 1
        // the timeout will be calculated as follows = sessionTimeout * threshold 
        threshold: 0.7,
        // adjust the path if needed 
        electionPath: '/election'
    });
});

client.connect();
```

Make sure to replace `'zookeeper-server:2181'` with the actual address of your ZooKeeper server. When a process is elected as the leader, the `leaderCallback` function will be executed, allowing you to perform the necessary leader tasks.

## Caveats

- **ZooKeeper Dependency**: Node Standby relies on the `node-zookeeper-client` library, which is a dependency. Make sure to have ZooKeeper installed and running, and provide the correct ZooKeeper server address when creating the ZooKeeper client instance.

- **Session Management**: Ensure that the ZooKeeper client's session remains active for the duration of leader election. If the client's session ends or disconnects, the ephemeral znodes created by Node Standby will be automatically deleted, triggering a new leader election.

- **Error Handling**: Proper error handling should be implemented in your application to handle potential failures and exceptions that may occur during the leader election process or ZooKeeper interactions.

## License

Node Standby is released under the MIT License. See the [LICENSE](LICENSE) file for details.

---

We hope that Node Standby simplifies your leader election implementation and contributes to the reliability of your distributed systems. Feel free to contribute, report issues, or suggest enhancements on our GitHub repository.

Happy coding!

---
