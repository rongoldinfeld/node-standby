import {Client, CreateMode, Event} from 'node-zookeeper-client'
import debug from "debug";

const sequenceLogger = debug('node-standby:sequence')

const getLoggerForSequence = (sequence: number) => (message: string, ...args: any[]) => sequenceLogger(`[Sequence: ${sequence}] ${message}`, ...args)

const getSequenceFromPath = (path: string): number => parseInt(path.substr(path.lastIndexOf('_') + 1), 10);

export const registerCallback = (client: Client, callback: Function, electionPath: string = `/election`) => {
    // Volunteering to be a leader
    client.create(`${electionPath}/guid-n_`, CreateMode.EPHEMERAL_SEQUENTIAL, (error, path) => {
        if (error) {
            throw new Error(`Failed at creating znode: ${error}`)
        }

        const sequenceNumber = getSequenceFromPath(path);
        const logger = getLoggerForSequence(sequenceNumber);

        logger(`Created node %d`, sequenceNumber);

        client.getChildren(electionPath, (error, children) => {
            if (error) {
                throw new Error(`Failed to get children: ${error}`)
            }

            logger(`Got children sequences: %s`, children.map(getSequenceFromPath));

            const smallerChildren = children.filter(child => {
                const childSequenceNumber = getSequenceFromPath(child);
                return childSequenceNumber < sequenceNumber;
            });


            if (smallerChildren.length === 0) {
                logger('No smaller sequence, elected as the leader');
                callback();
            } else {
                logger('Smaller sequences: %s', children.map(getSequenceFromPath));
                const watchNodePath: string = smallerChildren.sort()[smallerChildren.length - 1];
                logger(`Largest znode with a smaller sequence number %d`, getSequenceFromPath(watchNodePath));
                watchZNodeChanges(watchNodePath, getSequenceFromPath(path));
            }
        });
    });

    function watchZNodeChanges(watchNodePath: string, currentSequence: number) {
        const logger = getLoggerForSequence(currentSequence);
        client.exists(`${electionPath}/${watchNodePath}`, (event: Event) => {
            if (event.getType() === Event.NODE_DELETED) {
                logger(`Received delete event %d`, getSequenceFromPath(event.path))
                client.getChildren(electionPath, (error, children) => {
                    if (error) {
                        throw new Error(`Failed to get children sequences: ${error}`);
                    }

                    const smallestChild = children.sort()[0];

                    if (currentSequence === getSequenceFromPath(smallestChild)) {
                        logger(`Elected as the new leader since ${currentSequence} is the smallest sequence`);
                        callback();
                    } else {
                        // Watch the next znode down the sequence
                        watchZNodeChanges(smallestChild, currentSequence);
                    }
                });
            }
        }, (error, stat) => {
            if (error) {
                throw new Error(`Exists command failed ${error}`);
            }

            const watchedSequence = getSequenceFromPath(watchNodePath);
            if (!stat) {
                logger(`Path does not exist Unable to set watch on path: %d`, watchedSequence);
            } else {
                logger(`Setting watch on sequence: %d`, watchedSequence);
            }
        });
    }
}
