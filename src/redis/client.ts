import { RedisClientType } from "redis";
import { FnInfo, FnStatus, isFnInfoType } from "../types/fn";

export const getInfo = async (
  name: string,
  client: RedisClientType
): Promise<FnInfo | null> => {
  const result: string | null = await client.get(name);

  if (!result) {
    return null;
  }

  const info: string = JSON.parse(result);

  if (!isFnInfoType(info)) {
    throw new Error(
      `'${name}' key contains unexpected value in redis, probably modified externally`
    );
  }

  return info;
};

const setInfo = async (
  name: string,
  status: FnStatus,
  client: RedisClientType,
  holder: string,
  ttl?: number
): Promise<void> => {
  await client.set(name, JSON.stringify({ holder, status }), {
    EX: ttl,
  });
};

export const setAsActive = async (
  key: string,
  holder: string,
  client: RedisClientType
): Promise<void> => await setInfo(key, FnStatus.ACTIVE, client, holder, 2);

export const setAsWaiting = async (
  key: string,
  client: RedisClientType
): Promise<void> => setInfo(key, FnStatus.WAITING, client, "none");
