import { Client, CreateMode, Event, Stat } from "node-zookeeper-client";
import { standby } from "./index";

describe("Node Standby", () => {
  let client: Client;
  const mockCreate = jest.fn((path, mode, callback) => {
    callback(null, `${path}/guid-n_1`);
  });
  const mockGetChildren = jest.fn((path, callback) => {
    callback(null, ["guid-n_1"]);
  });
  const mockExists = jest.fn();

  let leaderCallback: jest.Mock<any, any, any>;

  beforeEach(() => {
    jest.useFakeTimers();
    leaderCallback = jest.fn();

    client = {
      create: mockCreate,
      getChildren: mockGetChildren,
      exists: mockExists,
      getState: jest.fn(() => ({ name: "SYNC_CONNECTED" })),
      getSessionTimeout: jest.fn(() => 3000),
      on: jest.fn((event: string, callback: (error: Error | null, stat: Stat) => void) => {
        callback(null, {} as Stat);
      }),
    } as unknown as Client;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("should register for leader election and execute callback when elected", async () => {
    standby({ client, threshold: 0.7, callback: leaderCallback });
    await jest.advanceTimersToNextTimerAsync(1);
    expect(mockCreate).toHaveBeenCalledWith("/election/guid-n_", CreateMode.EPHEMERAL_SEQUENTIAL, expect.any(Function));
    expect(mockGetChildren).toHaveBeenCalledWith("/election", expect.any(Function));
    expect(leaderCallback).toHaveBeenCalled();
  });

  it("should watch znode changes and execute callback when becoming the new leader", async () => {
    mockCreate.mockImplementation((path, mode, callback) => {
      callback(null, `${path}/guid-n_2`);
    });

    mockGetChildren
      .mockImplementationOnce((path, callback) => {
        callback(null, ["guid-n_1", "guid-n_2"]);
      })
      .mockImplementationOnce((path, callback) => {
        callback(null, ["guid-n_2"]);
      });

    mockExists.mockImplementationOnce((path, watcher, callback) => {
      watcher({ getType: () => Event.NODE_DELETED, path: `${path}/guid-n_1` });
      callback(null, {});
    });

    standby({ client, threshold: 0.7, callback: leaderCallback });
    await jest.advanceTimersToNextTimerAsync(1);
    expect(mockCreate).toHaveBeenCalledWith("/election/guid-n_", CreateMode.EPHEMERAL_SEQUENTIAL, expect.any(Function));
    expect(mockGetChildren).toHaveBeenCalledWith("/election", expect.any(Function));
    expect(mockExists).toHaveBeenCalledWith("/election/guid-n_1", expect.any(Function), expect.any(Function));
    expect(mockGetChildren).toHaveBeenCalledWith("/election", expect.any(Function));
    expect(leaderCallback).toHaveBeenCalled();
  });

  it("should watch znode changes and continue watching the next znode down the sequence", async () => {
    mockCreate.mockImplementationOnce((path, mode, callback) => {
      callback(null, `${path}/guid-n_3`);
    });
    mockGetChildren
      .mockImplementationOnce((path, callback) => {
        callback(null, ["guid-n_1", "guid-n_2", "guid-n_3"]);
      })
      .mockImplementationOnce((path, callback) => {
        callback(null, ["guid-n_1", "guid-n_3"]);
      })
      .mockImplementationOnce((path, callback) => {
        callback(null, ["guid-n_3"]);
      });
    mockExists.mockImplementationOnce((path, watcher, callback) => {
      callback(null, {} as Stat);
      watcher({ getType: () => Event.NODE_DELETED, path: `${path}/guid-n_2` });
    });
    standby({ client, threshold: 0.7, callback: leaderCallback });
    await jest.advanceTimersToNextTimerAsync(1);
    expect(mockCreate).toHaveBeenCalledWith("/election/guid-n_", CreateMode.EPHEMERAL_SEQUENTIAL, expect.any(Function));
    expect(mockGetChildren).toHaveBeenCalledWith("/election", expect.any(Function));
    expect(mockExists).toHaveBeenCalledWith("/election/guid-n_1", expect.any(Function), expect.any(Function));
    mockExists.mockImplementationOnce((path, watcher, callback) => {
      callback(null, {});
      watcher({ getType: () => Event.NODE_DELETED, path: `${path}/guid-n_1` });
    });
    await jest.advanceTimersToNextTimerAsync(1);
    expect(mockExists).toHaveBeenCalledWith("/election/guid-n_2", expect.any(Function), expect.any(Function));
    expect(mockGetChildren).toHaveBeenCalledWith("/election", expect.any(Function));
    expect(leaderCallback).toHaveBeenCalledTimes(0);
  });
});
