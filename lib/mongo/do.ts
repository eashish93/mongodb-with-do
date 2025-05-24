import { DurableObject } from 'cloudflare:workers';
import { MongoClient, Db,Collection, Filter, UpdateFilter, FindOneAndUpdateOptions, FindOneAndDeleteOptions, FindOneAndReplaceOptions, DistinctOptions, FindOptions, WithId, Document, TransactionOptions, ClientSession } from 'mongodb';
import { serializeToJSON, deserializeFromJSON } from './serialization';
import type { ToJsonFriendly } from './bson-types';
import { executeMongoOperation, prepareArgsWithSession } from './operationExecutor'; // Import shared functions

// Define an interface for the environment variables passed to the DO
export interface Env {
  MONGODB_URI: string;
  MONGODB_DB: string;
  // MONGO_DO: DurableObjectNamespace;
}


export interface MongoRpcPayload {
  col: string;
  op: // Clearer name for the operation
  | 'findOne'
    | 'find'
    | 'findOneAndUpdate'
    | 'findOneAndDelete'
    | 'findOneAndReplace'
    | 'insertOne'
    | 'insertMany'
    | 'updateOne'
    | 'updateMany'
    | 'deleteOne'
    | 'deleteMany'
    | 'aggregate'
    | 'distinct'
    | 'countDocuments';
  args: ToJsonFriendly<unknown[]>; // Clearer name
}
export type MongoRpcResponseData = ToJsonFriendly<unknown>; // Clearer name


// Define the Durable Object class
export class MongoDurableObject extends DurableObject {
  // define mongodb client.
  client: MongoClient;
  connectPromise: Promise<void> | null = null;
  db: Db | null = null;
  // collection: Collection<Document> | null = null; // 'collection' property is not used, can be removed or ensure it's properly initialized if intended for use.
  env: Env;

  // Keep-alive interval. According to Cloudflare docs (late 2023),
  // a DO may be evicted after 60s of inactivity. Alarms count as activity.
  // Setting to 50s to be safe and also to exercise the DB connection to keep it alive to reduce cold start.

  // Option 1: Increase interval significantly
  private keepAliveIntervalMs = 50 * 1000; // 50 seconds (closer to 60s DO eviction)

  // Option 2: For conditional pinging
  private alarmPingCounter = 0;
  // Ping DB every N alarms. If keepAliveIntervalMs is 55s, 10 means ~9 minutes.
  private pingMongoEveryNAlarms = 10;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env); // Pass context/state to super

    const options = {
      maxPoolSize: 10, // Keep pool size modest for DO
      maxConnecting: 5,
      // serverSelectionTimeoutMS: 5000,
      // maxIdleTimeMS: 20 * 1000, // Close idle connections
      // connectTimeoutMS: 10000, // 10 seconds
      // socketTimeoutMS: 45000, // 45 seconds
    };
    // Initialize the MongoClient in the constructor for the lifetime of the DO instance.
    this.env = env;
    this.client = new MongoClient(env.MONGODB_URI, options);
    this.db = this.client.db(env.MONGODB_DB);

    // Schedule the first alarm if none is set, using waitUntil for async constructor tasks.
    this.ctx.waitUntil(this.ensureAlarmScheduled());
  }

  private async ensureAlarmScheduled(): Promise<void> {
    try {
      const currentAlarm = await this.ctx.storage.getAlarm();
      if (currentAlarm === null) {
        console.log(
          `[MongoDO ${this.ctx.id.toString()}] No alarm set. Scheduling initial keep-alive alarm in ${this.keepAliveIntervalMs / 1000}s.`
        );
        await this.ctx.storage.setAlarm(Date.now() + this.keepAliveIntervalMs);
      }
    } catch (error) {
      console.error(
        `[MongoDO ${this.ctx.id.toString()}] Error ensuring alarm is scheduled:`,
        error
      );
    }
  }

  async alarm() {
    const doIdStr = this.ctx.id.toString();
    // This is the alarm handler. It's called when an alarm set by setAlarm() triggers.

    this.alarmPingCounter++;

    if (this.alarmPingCounter >= this.pingMongoEveryNAlarms) {
      this.alarmPingCounter = 0; // Reset counter

      if (this.client && this.db) {
        try {
          await this.db.admin().ping();
        } catch (err: any) {
          console.error(
            `[MongoDO ${doIdStr}] Error pinging MongoDB during scheduled alarm: ${err.message}.`
          );
        }
      } 
    }

    // IMPORTANT: Reschedule the alarm for the next interval to create a recurring alarm.
    try {
      await this.ctx.storage.setAlarm(Date.now() + this.keepAliveIntervalMs);
    } catch (error) {
      console.error(`[MongoDO ${doIdStr}] Error rescheduling alarm:`, error);
    }
  }

  async runTransaction(
    payloads: MongoRpcPayload[],
    txOptions?: TransactionOptions
  ): Promise<MongoRpcResponseData[]> {
    // Renamed options to txOptions for clarity and updated return type
    const results: MongoRpcResponseData[] = []; // Array to store results
    await this.client.withSession(async (session) => {
      // This 'session' is the ClientSession for the whole operation
      return await session.withTransaction(async (txSession) => {
        // txSession is the ClientSession specifically for this transaction
        for (const payload of payloads) {
          // Pass the transaction-specific session (txSession) to the execute method
          const result = await this.execute(payload, txSession);
          results.push(result); // Collect each result
        }
      }, txOptions); // Pass transaction options here
    });
    return results; // Return the array of results
  }

  public async execute(
    payload: MongoRpcPayload,
    session?: ClientSession
  ): Promise<MongoRpcResponseData> {
    const { col, op, args: originalArgsFromJson } = payload;
    try {
      if (!this.db) {
        throw new Error(
          `[MongoDO ${this.ctx.id.toString()}] Database instance not available after connection attempt.`
        );
      }
      const collection: Collection<Document> = this.db.collection(col);

      let finalArgs = deserializeFromJSON(originalArgsFromJson) as any[];

      if (session) {
        finalArgs = prepareArgsWithSession(finalArgs, op, session); // Use shared function
      }

      // Use the shared function to execute the operation
      const operationResult = await executeMongoOperation(collection, op, finalArgs);

      return serializeToJSON(operationResult);
    } catch (error: any) {
      console.error(
        `MongoDO RPC Error (Op: ${op}, Coll: ${col}, InTx: ${!!session}):`,
        error.message,
        error.stack // Include stack for better debugging
      );
      // Re-throw the original error so the caller (e.g., CollectionProxy or transaction orchestrator) can handle it
      throw error;
    }
  }
}


