import 'server-only';
import {
  ObjectId as NativeObjectId,
  Filter,
  Document,
  OptionalUnlessRequiredId,
  InsertOneResult,
  InsertManyResult,
  UpdateFilter,
  UpdateResult,
  DeleteResult,
  CountDocumentsOptions,
  FindOptions,
  UpdateOptions,
  DeleteOptions,
  InsertOneOptions,
  BulkWriteOptions,
  AggregateOptions,
  WithId,
  // New types:
  FindOneAndUpdateOptions,
  FindOneAndDeleteOptions,
  FindOneAndReplaceOptions,
  ReturnDocument, // For options of findOneAndModify methods
  DistinctOptions, // For distinct method options
  MatchKeysAndValues,
  TransactionOptions, // Used internally by distinct return type
  ClientSession, // Added for local transactions
  Sort,
} from 'mongodb';
import { serializeToJSON, deserializeFromJSON } from './serialization';
import type { ToJsonFriendly } from './bson-types';
// Make sure this path correctly points to your DO file and exports the class
import type {
  MongoDurableObject,
  MongoRpcPayload,
  MongoRpcResponseData,
} from './do';
import db, { client } from './client-local';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { executeMongoOperation, prepareArgsWithSession } from './operationExecutor'; // Import the shared functions
import { FindCursor } from './FindCursor';
import { AggregateCursor } from './AggregateCursor';
import { ICollectionProxy } from './types';

export interface AppEnv {
  MONGO_DO: DurableObjectNamespace;
}

// Define a new type for transaction payloads with native JS arguments
interface TransactionPayloadWithNativeArgs {
  col: string;
  op: MongoRpcPayload['op']; // Reuse op type from MongoRpcPayload
  args: unknown[]; // Native JS arguments, not yet serialized
}

// sharding config (not required, but useful for scaling)
const NUMBER_OF_DO_SHARDS = 2;  // increase this number to add more shards
const DO_INSTANCE_NAME_PREFIX = "mongo_shard_"; // Consistent prefix

// This class remains the same, it's the direct interface to MongoDB methods
class CollectionProxy<TSchema extends Document = Document> implements ICollectionProxy<TSchema> {
  private collectionName: string;
  private doStub: DurableObjectStub<MongoDurableObject>; // Use new DO class name

  constructor(collectionName: string, doStub: DurableObjectStub<MongoDurableObject>) {
    this.collectionName = collectionName;
    this.doStub = doStub;
  }

  private async _executeRemote<TArgs extends unknown[], TDriverResult>(
    op: MongoRpcPayload['op'],
    args: TArgs
  ): Promise<TDriverResult> {
    const argumentsAsJson = serializeToJSON(args) as ToJsonFriendly<unknown[]>;
    const payload: MongoRpcPayload = {
      col: this.collectionName,
      op,
      args: argumentsAsJson,
    };
    try {
      const responseDataJson: MongoRpcResponseData = await (this.doStub.execute(payload) as Promise<MongoRpcResponseData>);
      return deserializeFromJSON(responseDataJson) as TDriverResult;
    } catch (error: any) {
      console.error(
        `DB Client RPC Error (Op: ${op}, Coll: ${this.collectionName}):`,
        error.message
      );
      throw error;
    }
  }

  // Internal method used by FindCursor
  async _executeFindWithOptions(filter: Filter<TSchema>, options?: FindOptions): Promise<WithId<TSchema>[]> {
    return this._executeRemote('find', [filter, options]);
  }

  // Internal method used by AggregateCursor
  async _executeAggregateWithOptions<TResultDoc extends Document = Document>(pipeline: Document[], options?: AggregateOptions): Promise<TResultDoc[]> {
    return this._executeRemote('aggregate', [pipeline, options]);
  }

  async findOne(filter: Filter<TSchema>, options?: FindOptions): Promise<WithId<TSchema> | null> {
    return await this._executeRemote('findOne', [filter, options]);
  }
  
  // Modified find method to return FindCursor
  find(filter: Filter<TSchema> = {}): FindCursor<TSchema> {
    return new FindCursor(filter, this);
  }

  
  async findOneAndUpdate(
    filter: Filter<TSchema>,
    update: UpdateFilter<TSchema>,
    options?: FindOneAndUpdateOptions // Options can include returnDocument: 'before' | 'after'
  ): Promise<WithId<TSchema> | null> {
    // Returns the document (before or after update, or null)
    return this._executeRemote('findOneAndUpdate', [filter, update, options]);
  }
  async findOneAndDelete(
    filter: Filter<TSchema>,
    options?: FindOneAndDeleteOptions
  ): Promise<WithId<TSchema> | null> {
    // Returns the deleted document or null
    return this._executeRemote('findOneAndDelete', [filter, options]);
  }
  async findOneAndReplace(
    filter: Filter<TSchema>,
    replacement: Document, // The replacement document (driver ensures no _id on this if upserting)
    options?: FindOneAndReplaceOptions
  ): Promise<WithId<TSchema> | null> {
    // Returns the original or replaced document, or null
    return this._executeRemote('findOneAndReplace', [filter, replacement, options]);
  }
  async insertOne(
    doc: OptionalUnlessRequiredId<TSchema>,
    options?: InsertOneOptions
  ): Promise<InsertOneResult<TSchema>> {
    return this._executeRemote('insertOne', [doc, options]);
  }
  async insertMany(
    docs: OptionalUnlessRequiredId<TSchema>[],
    options?: BulkWriteOptions
  ): Promise<InsertManyResult<TSchema>> {
    // InsertManyOptions is correct
    return this._executeRemote('insertMany', [docs, options]);
  }
  async updateOne(
    filter: Filter<TSchema>,
    update: UpdateFilter<TSchema> | Partial<TSchema>,
    options?: UpdateOptions
  ): Promise<UpdateResult> {
    return this._executeRemote('updateOne', [filter, update, options]);
  }
  async updateMany(
    filter: Filter<TSchema>,
    update: UpdateFilter<TSchema>,
    options?: UpdateOptions
  ): Promise<UpdateResult> {
    return this._executeRemote('updateMany', [filter, update, options]);
  }
  async deleteOne(filter: Filter<TSchema>, options?: DeleteOptions): Promise<DeleteResult> {
    return this._executeRemote('deleteOne', [filter, options]);
  }
  async deleteMany(filter: Filter<TSchema>, options?: DeleteOptions): Promise<DeleteResult> {
    return this._executeRemote('deleteMany', [filter, options]);
  }
  
  // Modified aggregate method to return AggregateCursor
  aggregate<TResultDoc extends Document = Document>(
    pipeline: Document[],
    options?: AggregateOptions
  ): AggregateCursor<TResultDoc> {
    return new AggregateCursor<TResultDoc>(pipeline, this as any);
  }

  async distinct<TValue = any>( // The type of the distinct values
    key: string, // keyof WithId<TSchema> is more type-safe but string is simpler for proxy
    filter?: Filter<TSchema>,
    options?: DistinctOptions
  ): Promise<TValue[]> {
    return this._executeRemote('distinct', [key, filter, options]);
  }
  async countDocuments(filter?: Filter<TSchema>, options?: CountDocumentsOptions): Promise<number> {
    return this._executeRemote('countDocuments', [filter, options]);
  }
}

// --- Simplified `getDbCollection` function ---
// This cache helps reuse stubs for the same DO ID name.
// const doStubsCache = new Map<string, DurableObjectStub<MongoDurableObject>>(); // Commenting out the cache


// sharding logic function
function getDoStubForShard(
  appEnv: AppEnv,
  shardKey?: string | number
): DurableObjectStub<MongoDurableObject> {
  if (!appEnv.MONGO_DO) {
    throw new Error('getDoStubForShard: MONGO_DO binding missing from AppEnv.');
  }

  let shardIndex = 0;
  if (typeof shardKey === 'number') {
    shardIndex = Math.abs(shardKey) % NUMBER_OF_DO_SHARDS;
  } else if (typeof shardKey === 'string' && shardKey.length > 0) {
    let hash = 0;
    for (let i = 0; i < shardKey.length; i++) {
      const char = shardKey.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    shardIndex = Math.abs(hash) % NUMBER_OF_DO_SHARDS;
  } else {
    // Default to random shard if no key provided - good for distributing load for unkeyed operations
    shardIndex = Math.floor(Math.random() * NUMBER_OF_DO_SHARDS);
  }

  const doInstanceName = `${DO_INSTANCE_NAME_PREFIX}${shardIndex}`; // e.g., kitful_mongo_proxy_shard_0

  // Don't cache the DO stub, otherwise worker will give error.
  // check here: https://opennext.js.org/cloudflare/troubleshooting#error-cannot-perform-io-on-behalf-of-a-different-request
  const durableObjectId = appEnv.MONGO_DO.idFromName(doInstanceName); // Use your binding
  const newStub = appEnv.MONGO_DO.get(durableObjectId) as DurableObjectStub<MongoDurableObject>;

  return newStub; // Always return a new stub
}

/**
 * Gets a CollectionProxy for a specific MongoDB collection.
 * This is now the primary way to interact with the database.
 * @param appEnv The application environment (e.g., process.env from Worker).
 * @param collectionName The name of the MongoDB collection.
 * @param shardKey Optional: Name for the Durable Object ID.
 * @returns A CollectionProxy instance.
 */
export function getCollection<TSchema extends Document = Document>(
  collectionName: string,
  shardKey?: string | number
) {

  if (process.env.NODE_ENV === 'development') {
    // because we can't test DO easily in local dev mode, so workaround to 
    // use mongo client directly.
    return db.collection(collectionName);
  }
  else {
    const appEnv = getCloudflareContext().env as unknown as AppEnv;
     let doStub = getDoStubForShard(appEnv, shardKey);
     return new CollectionProxy<TSchema>(collectionName, doStub);
  }
 
}

export async function runTransaction(payloads: TransactionPayloadWithNativeArgs[], txOptions?: TransactionOptions): Promise<any[]> { // Updated payload type
  if(process.env.NODE_ENV === 'development') {
    const results: any[] = []; // Array to store results for dev path
    await client.withSession(async (session: ClientSession) => {
      await session.withTransaction(async (txSession: ClientSession) => {
        for (const payload of payloads) {
          const { col, op, args } = payload; // args are now native
          const collection = db.collection(col);
          
          // No need to deserialize args, they are already native
          const finalArgs = prepareArgsWithSession(args, op, txSession); 

          const operationResult = await executeMongoOperation(collection, op, finalArgs);
          results.push(operationResult); // Collect each result
        }
      }, txOptions);
    });
    return results; // Return the array of results for dev path
  }
  else {
    const appEnv = getCloudflareContext().env as unknown as AppEnv;
    const doStub = getDoStubForShard(appEnv);

    // Serialize arguments before sending to DO
    const serializedPayloads: MongoRpcPayload[] = payloads.map(p => ({
      ...p,
      args: serializeToJSON(p.args) as ToJsonFriendly<unknown[]>, // Serialize native args
    }));

    const doResults: MongoRpcResponseData[] = await (doStub.runTransaction(serializedPayloads, txOptions) as Promise<MongoRpcResponseData[]>);
    // Deserialize results from DO
    return doResults.map((result: MongoRpcResponseData) => deserializeFromJSON(result)); 
  }
}

export { NativeObjectId as ObjectId, FindCursor, AggregateCursor };
