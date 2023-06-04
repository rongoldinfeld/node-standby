import { Client, CreateMode, Event, State } from "node-zookeeper-client";
import debug from "debug";
import { createAsyncZookeeperAdapter, ZookeeperAsyncAdapter } from "./client-async";

export interface CallbackParams {
  client: Client;
  callback: (sequence: number) => Function | undefined;
  threshold: number;
  electionPath?: string;
}

const seqLogger = debug("node-standby:sequence");
const log = debug("node-standby:connection");

const getLoggerForSequence =
  (sequence: number) =>
  (message: string, ...args: any[]) =>
    seqLogger(`[Sequence: ${sequence}] ${message}`, ...args);

const getSequenceFromPath = (path: string): number => parseInt(path.substring(path.lastIndexOf("_") + 1), 10);

const throwDisconnectAfterThreshold = (client: Client, timeoutThreshold: number, cleanup?: Function) => {
  client.on("disconnected", () => {
    log(`Received disconnected event!, status will be checked again in: %dms`, timeoutThreshold);
    setTimeout(() => {
      const state = client.getState();
      log(`Current connection state after the last disconnect: %s`, state.name);
      if (state.code === State.DISCONNECTED.code) {
        log(`Threshold reached, running cleanup function and throwing disconnect error`);
        cleanup && cleanup();
        throw new Error("Zookeeper client disconnected");
      } else {
        log("Reconnected before threshold was reached");
      }
    }, timeoutThreshold);
  });
};

const createNode = async (client: ZookeeperAsyncAdapter, electionPath: string): Promise<string> => {
  const [creationError, createdNodePath] = await client.createAsync(
    `${electionPath}/guid-n_`,
    CreateMode.EPHEMERAL_SEQUENTIAL
  );

  if (creationError) {
    throw new Error(`Failed at creating znode: ${creationError}`);
  }

  return createdNodePath;
};

const getChildren = async (client: ZookeeperAsyncAdapter, electionPath: string): Promise<string[]> => {
  const [getChildrenError, children] = await client.getChildrenAsync(electionPath);

  if (getChildrenError) {
    throw new Error(`Failed to get children: ${getChildrenError}`);
  }

  return children;
};

export const registerForLeaderElection = async ({
  client,
  callback,
  threshold,
  electionPath = `/election`,
}: CallbackParams) => {
  const sessionTimeout: number = client.getSessionTimeout();
  const timeoutThreshold: number = sessionTimeout * threshold;

  if (threshold > 1) {
    log(`Threshold > 1, which means the process will still be active even after session timeout`);
  }

  const asyncClient = createAsyncZookeeperAdapter(client);

  const createdNodePath = await createNode(asyncClient, electionPath);
  const sequenceNumber = getSequenceFromPath(createdNodePath);
  const logger = getLoggerForSequence(sequenceNumber);
  logger(`Created node %d`, sequenceNumber);
  const children = await getChildren(asyncClient, electionPath);
  logger(`Got children sequences: %s`, children.map(getSequenceFromPath));

  const smallerChildren = children.filter((child) => {
    const childSequenceNumber = getSequenceFromPath(child);
    return childSequenceNumber < sequenceNumber;
  });

  if (smallerChildren.length === 0) {
    logger("No smaller sequence, elected as the leader");
    const cleanup = callback(sequenceNumber);
    throwDisconnectAfterThreshold(client, timeoutThreshold, cleanup);
  } else {
    logger("Smaller sequences: %s", children.map(getSequenceFromPath));
    const watchNodePath: string = smallerChildren.sort()[smallerChildren.length - 1];
    logger(`Largest znode with a smaller sequence number %d`, getSequenceFromPath(watchNodePath));
    watchZNodeChanges(watchNodePath, getSequenceFromPath(createdNodePath));
  }

  async function watchZNodeChanges(watchNodePath: string, currentSequence: number) {
    const logger = getLoggerForSequence(currentSequence);
    const [existsError] = await asyncClient.watchAsync(`${electionPath}/${watchNodePath}`, async (event) => {
      if (event.getType() === Event.NODE_DELETED) {
        logger(`Received delete event %d`, getSequenceFromPath(event.path));

        const children = await getChildren(asyncClient, electionPath);
        const smallestChild = children.sort()[0];

        if (currentSequence === getSequenceFromPath(smallestChild)) {
          logger(`Elected as the new leader since ${currentSequence} is the smallest sequence`);
          const cleanup = callback(currentSequence);
          throwDisconnectAfterThreshold(client, timeoutThreshold, cleanup);
        } else {
          // Watch the next znode down the sequence
          watchZNodeChanges(smallestChild, currentSequence);
        }
      }
    });

    if (existsError) {
      throw new Error(`Watch failed. ${existsError}`);
    }
  }
};
