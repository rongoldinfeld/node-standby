import { CallbackParams, registerForLeaderElection } from "./zookeeper/leader-election";

export const standby = (params: CallbackParams) => registerForLeaderElection(params);
