import {ACL, Client, Event, Exception, Stat} from "node-zookeeper-client";

type Either<TData, TError> = [TError, undefined?] | [undefined, TData];

type ZooKeeperAsyncResult<T> = Promise<Either<T, Error | Exception>>;

export interface ZookeeperAsyncAdapter {
    getChildrenAsync: (path: string) => ZooKeeperAsyncResult<string[]>;
    watchAsync: (path: string, watcher: (event: Event) => void) => ZooKeeperAsyncResult<Stat>;
    createAsync: (path: string, dataOrAclsOrmode1: (Buffer | ACL[] | number)) => ZooKeeperAsyncResult<string>;
}

export const createAsyncZookeeperAdapter = (client: Client): ZookeeperAsyncAdapter => ({
    createAsync: (path: string, dataOrAclsOrmode1: Buffer | ACL[] | number): ZooKeeperAsyncResult<string> => {
        return new Promise((resolve) => {
            client.create(path, dataOrAclsOrmode1, (error: Error | Exception, path: string) => {
                if (error) {
                    resolve([error, undefined]);
                } else {
                    resolve([undefined, path]);
                }
            });
        });
    },
    getChildrenAsync: (path: string): ZooKeeperAsyncResult<string[]> => {
        return new Promise((resolve) => {
            client.getChildren(path, (error: Error | Exception, children: string[]) => {
                if (error) {
                    resolve([error, undefined]);
                } else {
                    resolve([undefined, children]);
                }
            });
        });
    },
    watchAsync: (path: string, watcher: (event: Event) => void): ZooKeeperAsyncResult<Stat> => {
        return new Promise(resolve => {
            client.exists(path, watcher, (error, stat) => {
                if (error || !stat) {
                    resolve([error || `Path ${path} does not exist Unable to set watch on path`, undefined])
                } else {
                    resolve([undefined, stat])
                }
            })
        })
    }
})

