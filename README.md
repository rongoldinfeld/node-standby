# node-standby

`node-standby` is a package that allows you to create a standby process that can take over if the primary process fails for some reason. It uses Redis to store information about the current active node and the function being run using UUID to ensure synchronization between processes.

## Installation
``` bash
npm install node-standby
```

## Usage
To use node-standby, you'll need to initialize an instance of the package and pass it a configuration object. Here's an example:
An express app which exposes one route which fails after a couple of seconds.

``` typescript
import express, { Express, Request, Response } from "express";
import { registerFunction } from "node-standby";
import { RedisClientType, createClient } from "redis";

const client: RedisClientType = createClient({ /* Your redis connection options */ });
client.on("error", (err: Error) => console.error(`Redis Error: ${err.message}`));

const app: Express = express();
const port = 3000;

app.get("/", async (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
  await new Promise((res) => setTimeout(res, 2000));
  throw new Error(`Random Error`);
});

const initApp = async () => {
  app.listen(port, () => {
    console.log(`⚡️[Server]: Server is running at http://localhost:${port}`);
  });
};

(async () => {
  await client.connect();
  registerFunction(client, initApp, {
    name: `expressApp`, // can be a function too
    pollingIntervalSeconds: 1,
    ttlSeconds: 2, // must be larger then pollingIntervalSeconds otherwise an error is thrown
  });
})();
```

When a request hits `GET http://localhost:3000` the process fails. If two identical process are running using `node-standby`, the backup will take place after the active has failed

## License

ISC
