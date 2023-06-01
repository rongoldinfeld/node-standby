import { Client, CreateMode, Event, State } from "node-zookeeper-client";
import debug from "debug";

const sequenceLogger = debug("node-standby:sequence");
const connectionLogger = debug("node-standby:connection");

const getLoggerForSequence =
  (sequence: number) =>
  (message: string, ...args: any[]) =>
    sequenceLogger(`[Sequence: ${sequence}] ${message}`, ...args);

const getSequenceFromPath = (path: string): number =>
  parseInt(path.substring(path.lastIndexOf("_") + 1), 10);

const throwDisconnectAfterThreshold = (
  client: Client,
  timeoutThreshold: number,
  cleanup?: Function
) => {
  client.on("disconnected", () => {
    connectionLogger(
      `Received disconnected event!, status will be checked again in: %dms`,
      timeoutThreshold
    );
    setTimeout(() => {
      const state = client.getState();
      connectionLogger(
        `Current connection state after the last disconnect: %s`,
        state.name
      );
      if (state.code === State.DISCONNECTED.code) {
        connectionLogger(
          `Threshold reached, running cleanup function and throwing disconnect error`
        );
        cleanup && cleanup();
        throw new Error("Zookeeper client disconnected");
      } else {
        connectionLogger("Reconnected before threshold was reached");
      }
    }, timeoutThreshold);
  });
};

export interface CallbackParams {
  client: Client;
  callback: (sequence: number) => Function | undefined;
  threshold: number;
  electionPath?: string;
}

export const registerForLeaderElection = ({
  client,
  callback,
  threshold,
  electionPath = `/election`,
}: CallbackParams) => {
  const sessionTimeout: number = client.getSessionTimeout();
  const timeoutThreshold: number = sessionTimeout * threshold;

  if (threshold > 1) {
    connectionLogger(
      `Threshold > 1, which means the process will still be active even after session timeout`
    );
  }

  // Volunteering to be a leader
  client.create(
    `${electionPath}/guid-n_`,
    CreateMode.EPHEMERAL_SEQUENTIAL,
    (error, path) => {
      if (error) {
        throw new Error(`Failed at creating znode: ${error}`);
      }

      const sequenceNumber = getSequenceFromPath(path);
      const logger = getLoggerForSequence(sequenceNumber);

      logger(`Created node %d`, sequenceNumber);

      client.getChildren(electionPath, (error, children) => {
        if (error) {
          throw new Error(`Failed to get children: ${error}`);
        }

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
          const watchNodePath: string =
            smallerChildren.sort()[smallerChildren.length - 1];
          logger(
            `Largest znode with a smaller sequence number %d`,
            getSequenceFromPath(watchNodePath)
          );
          watchZNodeChanges(watchNodePath, getSequenceFromPath(path));
        }
      });
    }
  );

  function watchZNodeChanges(watchNodePath: string, currentSequence: number) {
    const logger = getLoggerForSequence(currentSequence);
    client.exists(
      `${electionPath}/${watchNodePath}`,
      (event: Event) => {
        if (event.getType() === Event.NODE_DELETED) {
          logger(`Received delete event %d`, getSequenceFromPath(event.path));
          client.getChildren(electionPath, (error, children) => {
            if (error) {
              throw new Error(`Failed to get children sequences: ${error}`);
            }

            const smallestChild = children.sort()[0];

            if (currentSequence === getSequenceFromPath(smallestChild)) {
              logger(
                `Elected as the new leader since ${currentSequence} is the smallest sequence`
              );
              const cleanup = callback(currentSequence);
              throwDisconnectAfterThreshold(client, timeoutThreshold, cleanup);
            } else {
              // Watch the next znode down the sequence
              watchZNodeChanges(smallestChild, currentSequence);
            }
          });
        }
      },
      (error, stat) => {
        if (error) {
          throw new Error(`Exists command failed ${error}`);
        }

        const watchedSequence = getSequenceFromPath(watchNodePath);
        if (!stat) {
          logger(
            `Path does not exist Unable to set watch on path: %d`,
            watchedSequence
          );
        } else {
          logger(`Setting watch on sequence: %d`, watchedSequence);
        }
      }
    );
  }
};
