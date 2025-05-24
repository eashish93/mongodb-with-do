import { ObjectId as NativeObjectId } from 'mongodb';
export type SerializedObjectId = { $oid: string };
export type SerializedDate = { $date: string };
export type ToJsonFriendly<T = any> = T extends NativeObjectId
  ? SerializedObjectId
  : T extends Date
    ? SerializedDate
    : T extends Array<infer U>
      ? Array<ToJsonFriendly<U>>
      : T extends object
        ? { [K in keyof T]: ToJsonFriendly<T[K]> }
        : T;
export type FromJsonFriendly<T = any> = T extends SerializedObjectId
  ? NativeObjectId
  : T extends SerializedDate
    ? Date
    : T extends Array<infer U>
      ? Array<FromJsonFriendly<U>>
      : T extends { $oid: string; [key: string]: any }
        ? NativeObjectId
        : T extends { $date: string; [key: string]: any }
          ? Date
          : T extends object
            ? { [K in keyof T]: FromJsonFriendly<T[K]> }
            : T;
export function isSerializedObjectId(value: any): value is SerializedObjectId {
  return (
    typeof value === 'object' && value !== null && '$oid' in value && typeof value.$oid === 'string'
  );
}
export function isSerializedDate(value: any): value is SerializedDate {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$date' in value &&
    typeof value.$date === 'string'
  );
}
