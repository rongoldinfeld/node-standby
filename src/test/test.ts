import express, { Express, Request, Response } from "express";
import { registerFunction } from "..";
import { RedisClientType, createClient } from "redis";

const client: RedisClientType = createClient({
  url: `redis://default:redispw@localhost:32768`,
});

client.on("error", (err: Error) =>
  console.error(`Redis Error: ${err.message}`)
);

const app: Express = express();
const port = 5312;

app.get("/", async (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
  await new Promise((res) => setTimeout(res, 7000));
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
    name: `expressApp`,
    pollingIntervalSeconds: 1,
    ttlSeconds: 2,
  });
})();
