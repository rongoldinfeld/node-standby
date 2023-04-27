import debug from "debug";
import { v4 as uuidv4 } from "uuid";
import { RedisClientType } from "redis";

import { FnStatus } from "./types/fn";
import { getInfo, setAsActive, setAsWaiting } from "./redis/client";

const statusDebug = debug("node-standby:status");

const runFn = async (
  fn: Function,
  redisKey: string,
  client: RedisClientType,
  holder: string
): Promise<void> => {
  await setAsActive(redisKey, holder, client);
  try {
    fn();
  } catch (error) {
    statusDebug(
      `Error while running the function ${error}. Setting function status as waiting`
    );
    await setAsWaiting(redisKey, client);
  }
};

export const standby = (
  client: RedisClientType,
  fn: Function,
  options: {
    name: string | (() => string);
    pollingIntervalSeconds: number;
    ttlSeconds: number;
  }
): string => {
  if (options.pollingIntervalSeconds > options.ttlSeconds) {
    throw new Error(
      `TTL can't be smaller than polling interval, otherwise key will expire before lookup`
    );
  }

  const redisKey =
    typeof options.name === "function" ? options.name() : options.name;

  if (!redisKey) {
    throw new Error(`"name" is required`);
  }

  const holder = uuidv4();
  const intervalInMs = options.pollingIntervalSeconds * 1000;

  statusDebug(
    `Initiating interval, Redis Key = %s , Holder Id = %s, Interval = %d`,
    redisKey,
    holder,
    intervalInMs
  );

  setInterval(async () => {
    statusDebug(`Polling current function status...`);
    const currentInfo = await getInfo(redisKey, client);
    if (!currentInfo) {
      statusDebug(
        `Current function key in redis is empty (either expired or new), initiating...`
      );
      await runFn(fn, redisKey, client, holder);
      return;
    }

    const { status: currentStatus, holder: currentHolder } = currentInfo;

    if (currentStatus !== FnStatus.ACTIVE) {
      await runFn(fn, redisKey, client, holder);
    } else {
      if (currentHolder === holder) {
        statusDebug(
          `Current service is running the function, re-marking as active`
        );
        await setAsActive(redisKey, currentHolder, client);
      } else {
        statusDebug(`There is another service that runs the function`);
      }
    }
  }, intervalInMs);

  return holder;
};
