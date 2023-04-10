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

export const setInfo = async (
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
