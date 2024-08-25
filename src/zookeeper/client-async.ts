import { ACL, Client, Event, Exception, Stat } from "node-zookeeper-client";

export interface ZookeeperAsyncAdapter {
  getChildrenAsync: (path: string) => Promise<string[]>;
  watchAsync: (path: string, watcher: (event: Event) => void) => Promise<Stat>;
  createAsync: (path: string, dataOrAclsOrmode1: Buffer | ACL[] | number) => Promise<string>;
}

export const createAsyncZookeeperAdapter = (client: Client): ZookeeperAsyncAdapter => ({
  createAsync: (path: string, dataOrAclsOrmode1: Buffer | ACL[] | number): Promise<string> =>
    new Promise((resolve, reject) => {
      client.create(path, dataOrAclsOrmode1, (error: Error | Exception, path: string) => {
        if (error) {
          reject(`Failed at creating znode: ${error}`);
        } else {
          resolve(path);
        }
      });
    }),
  getChildrenAsync: (path: string): Promise<string[]> =>
    new Promise((resolve, reject) => {
      client.getChildren(path, (error: Error | Exception, children: string[]) => {
        if (error) {
          reject(`Failed to get children: ${error}`);
        } else {
          resolve(children);
        }
      });
    }),
  watchAsync: (path: string, watcher: (event: Event) => void): Promise<Stat> =>
    new Promise((resolve, reject) => {
      client.exists(path, watcher, (error, stat) => {
        if (error || !stat) {
          reject(`Watch failed. ${error || `Path ${path} does not exist Unable to set watch on path`}`);
        } else {
          resolve(stat);
        }
      });
    }),
});
