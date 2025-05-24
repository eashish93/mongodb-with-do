import { ObjectId as NativeObjectId } from 'mongodb';
import {
  SerializedObjectId,
  SerializedDate,
  isSerializedObjectId,
  isSerializedDate,
  ToJsonFriendly,
  FromJsonFriendly,
} from './bson-types';

export function serializeToJSON<TInput>(data: TInput): ToJsonFriendly<TInput> {
  if (data instanceof NativeObjectId) return { $oid: data.toHexString() } as ToJsonFriendly<TInput>;
  if (data instanceof Date) return { $date: data.toISOString() } as ToJsonFriendly<TInput>;
  if (Array.isArray(data))
    return data.map((item) => serializeToJSON(item)) as ToJsonFriendly<TInput>;
  if (
    data !== null &&
    typeof data === 'object' &&
    !(data instanceof NativeObjectId) &&
    !(data instanceof Date)
  ) {
    const resultObject: any = {};
    for (const key in data)
      if (Object.prototype.hasOwnProperty.call(data, key))
        resultObject[key] = serializeToJSON((data as any)[key]);
    return resultObject as ToJsonFriendly<TInput>;
  }
  return data as ToJsonFriendly<TInput>;
}

export function deserializeFromJSON<TOutput>(data: TOutput): FromJsonFriendly<TOutput> {
  if (isSerializedObjectId(data)) {
    try {
      return new NativeObjectId(data.$oid) as FromJsonFriendly<TOutput>;
    } catch {
      console.warn(`Invalid ObjectId string: ${data.$oid}`);
      return data as FromJsonFriendly<TOutput>;
    }
  }
  if (isSerializedDate(data)) {
    const dateValue = new Date(data.$date);
    if (isNaN(dateValue.getTime())) {
      console.warn(`Invalid Date string: ${data.$date}`);
      return data as FromJsonFriendly<TOutput>;
    }
    return dateValue as FromJsonFriendly<TOutput>;
  }
  if (Array.isArray(data))
    return data.map((item) => deserializeFromJSON(item)) as FromJsonFriendly<TOutput>;
  if (
    data !== null &&
    typeof data === 'object' &&
    !isSerializedObjectId(data) &&
    !isSerializedDate(data)
  ) {
    const resultObject: any = {};
    for (const key in data)
      if (Object.prototype.hasOwnProperty.call(data, key))
        resultObject[key] = deserializeFromJSON((data as any)[key]);
    return resultObject as FromJsonFriendly<TOutput>;
  }
  return data as FromJsonFriendly<TOutput>;
}
