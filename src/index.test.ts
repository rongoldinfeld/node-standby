import { expect, jest, test } from "@jest/globals";

import { standby } from "./index";
import { RedisClientType } from "redis";
import { FnInfo, FnStatus } from "./types/fn";

// test the register function
describe(`registerFunction`, () => {
  const getFn = jest.fn<(...args: any) => Promise<string | null>>();
  const setFn = jest.fn();
  const client: RedisClientType = {
    get: getFn,
    set: setFn,
  } as unknown as RedisClientType;

  beforeEach(() => jest.useFakeTimers());

  afterEach(() => jest.clearAllMocks());

  const mockGet = (fnInfo: FnInfo | null): void => {
    getFn.mockResolvedValueOnce(fnInfo ? JSON.stringify(fnInfo) : null);
  };

  test("should throw an error if polling interval is greater than ttl", async () => {
    expect(() =>
      standby(client, () => console.log("hello"), {
        name: "something",
        ttlSeconds: 2,
        pollingIntervalSeconds: 3,
      })
    ).toThrowError(
      `TTL can't be smaller than polling interval, otherwise key will expire before lookup`
    );
  });

  describe("Returned redis values", () => {
    test("should run the function provided once, if no value was set for key in redis", async () => {
      getFn.mockResolvedValueOnce(null);
      const fn = jest.fn();
      standby(client, fn, {
        name: "something",
        ttlSeconds: 2,
        pollingIntervalSeconds: 1,
      });
      await jest.advanceTimersToNextTimerAsync();
      expect(fn).toBeCalledTimes(1);
    });

    test("should not run the provided function again if the holder is me and marked as active active", async () => {
      const fn = jest.fn();
      const holder = standby(client, fn, {
        name: "something",
        ttlSeconds: 2,
        pollingIntervalSeconds: 1,
      });

      // returns null and activates function once
      mockGet(null);
      await jest.advanceTimersToNextTimerAsync(1);
      expect(fn).toBeCalledTimes(1);

      // returns that im the holder and the function is active
      fn.mockClear();
      mockGet({ holder, status: FnStatus.ACTIVE });
      await jest.advanceTimersToNextTimerAsync(1);

      expect(fn).toBeCalledTimes(0);
    });

    test(`should not run the provided function is the holder is active and not me`, async () => {
      const fn = jest.fn();
      const holder = standby(client, fn, {
        name: "something",
        ttlSeconds: 2,
        pollingIntervalSeconds: 1,
      });

      // returns that im not the holder and the function is active
      mockGet({ holder: holder + "not me", status: FnStatus.ACTIVE });
      await jest.advanceTimersToNextTimerAsync(1);

      expect(fn).toBeCalledTimes(0);
    });

    test(`should run the provided function is the holder is waiting and not me`, async () => {
      const fn = jest.fn();
      const holder = standby(client, fn, {
        name: "something",
        ttlSeconds: 2,
        pollingIntervalSeconds: 1,
      });

      // returns that im not the holder and the function is active
      mockGet({ holder: holder + "not me", status: FnStatus.WAITING });
      await jest.advanceTimersToNextTimerAsync(1);

      expect(fn).toBeCalledTimes(1);
    });

    test(`should re mark the function is active, if get returned that the function is active and the holder is me`, async () => {
      const fn = jest.fn();
      const holder = standby(client, fn, {
        name: "something",
        ttlSeconds: 2,
        pollingIntervalSeconds: 1,
      });

      // returns that im not the holder and the function is active
      mockGet({ holder, status: FnStatus.ACTIVE });
      await jest.advanceTimersToNextTimerAsync(1);

      expect(setFn).toBeCalledWith(
        "something",
        JSON.stringify({ holder, status: FnStatus.ACTIVE }),
        { EX: 2 }
      );
    });

    test(`should set the function as waiting if the function provided throws an error`, async () => {
      const fn = jest.fn().mockImplementationOnce(() => {
        throw new Error("something went wrong");
      });

      standby(client, fn, {
        name: "something",
        ttlSeconds: 2,
        pollingIntervalSeconds: 1,
      });
      mockGet(null);
      await jest.advanceTimersToNextTimerAsync(1);

      expect(setFn).toBeCalledWith(
        "something",
        JSON.stringify({ holder: "none", status: FnStatus.WAITING }),
        { EX: undefined }
      );
    });
  });
});
