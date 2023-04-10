import debug from "debug";
import { v4 as uuidv4 } from "uuid";
import { RedisClientType } from "redis";

import { FnStatus } from "./types/fn";
import { getInfo, setInfo } from "./redis/client";

const statusDebug = debug("node-standby:status");

const setAsActive = async (
  key: string,
  holder: string,
  client: RedisClientType
) => await setInfo(key, FnStatus.ACTIVE, client, holder, 2);

const setAsWaiting = async (key: string, client: RedisClientType) =>
  setInfo(key, FnStatus.WAITING, client, "none");

const runFn = async (
  fn: Function,
  redisKey: string,
  client: RedisClientType,
  holder: string
) => {
  await setAsActive(redisKey, holder, client);
  try {
    fn();
  } catch (error) {
    statusDebug(
      `Error while runnign the function ${error}. Setting function status as waiting`
    );
    await setAsWaiting(redisKey, client);
  }
};

export const registerFunction = async (
  client: RedisClientType,
  fn: Function,
  options: {
    name: string | (() => string);
    pollingIntervalSeconds: number;
    ttlSeconds: number;
  }
) => {
  if (options.pollingIntervalSeconds > options.ttlSeconds) {
    throw new Error(
      `TTL can't be smaller than polling interval, otherwise key will expire before lookup`
    );
  }

  const redisKey =
    typeof options.name === "function" ? options.name() : options.name;
  const holder = uuidv4();
  statusDebug(`Redis Key = %s , Holder Id = %s`, redisKey, holder);
  const pollingInterval = options.pollingIntervalSeconds;

  setInterval(async () => {
    statusDebug(`Polling current function status...`);
    const currentInfo = await getInfo(redisKey, client);

    if (!currentInfo) {
      statusDebug(`Current function key in redis is empty, initiating...`);
      runFn(fn, redisKey, client, holder);
      return;
    }

    const { status: currentStatus, holder: currentHolder } = currentInfo;

    if (currentStatus !== FnStatus.ACTIVE) {
      // TODO: Enable retry strategy
      runFn(fn, redisKey, client, holder);
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
  }, pollingInterval * 1000);
};
