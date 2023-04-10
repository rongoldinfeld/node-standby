export enum FnStatus {
  ACTIVE = "active",
  WAITING = "waiting",
}

export interface FnInfo {
  status: FnStatus;
  holder: string;
}

export const isFnStatusType = (type: any): type is FnStatus => {
  return !!(
    type &&
    typeof type === "string" &&
    (type === "active" || type === "waiting")
  );
};

export const isFnInfoType = (obj: any): obj is FnInfo => {
  if (obj.status && obj.holder) {
    return isFnStatusType(obj.status) && typeof obj.holder === "string";
  }

  return false;
};
