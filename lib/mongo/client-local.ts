import 'server-only';
import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

if (!MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

if (!MONGODB_DB) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_DB"');
}

const options = {
  maxPoolSize: 10, // default is 100. // keep it low for workers.
  maxConnecting: 5, // default is 2
};

let client: MongoClient;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _client?: MongoClient;
  };

  if (!globalWithMongo._client) {
    console.log('[Dev Mode] : Initializing mongodb');
    const client = new MongoClient(MONGODB_URI, options);
    //  (optional starting in v4.7)
    // see: https://github.com/mongodb/node-mongodb-native/releases/tag/v4.7.0
    // globalWithMongo._mongoClientPromise = client.connect();
    globalWithMongo._client = client;
  }
  client = globalWithMongo._client;
} else {
  console.log('[Production Mode] : Initializing mongodb');
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(MONGODB_URI, options);
  //  (optional starting in v4.7)
  // see: https://github.com/mongodb/node-mongodb-native/releases/tag/v4.7.0
  // clientPromise = client.connect();
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
let db = client.db(MONGODB_DB);
export default db;
// export client too for mongodb transaction.
export { client };
