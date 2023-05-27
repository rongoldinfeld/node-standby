import {Client} from "node-zookeeper-client";
import {registerCallback} from "./zookeeper/leader-electron";

export const standby = (
    client: Client,
    fn: Function,
) => registerCallback(client, fn);
