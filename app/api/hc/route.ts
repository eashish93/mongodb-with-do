import { getCollection } from '@/lib/mongo';

export const revalidate = 0;

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const collection = getCollection('test');
  const result = await collection.findOne({});

  return new Response(JSON.stringify(result));
}

/**
 * 
 * 
 * import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import errorHandler from '@/lib/apiError';
import { runTransaction } from '@/lib/mongo'; // Import runTransaction
// MongoRpcPayload might not be needed here anymore if not explicitly typing payloads,
// or can be replaced with a local type if desired.
// import { MongoRpcPayload } from '@/lib/mongo/do'; 
// serializeToJSON is no longer needed here
// import { serializeToJSON } from '@/lib/mongo/serialization'; 

// Example schema for accounts
interface Account {
  _id: ObjectId;
  name: string;
  balance: number;
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const fromAccountIdString = '682ddb3f83bce78cfb40b09e'; // Replace with actual ID
  const toAccountIdString = '682ddb3f83bce78cfb40b09f';   // Replace with actual ID
  const amountToTransfer = 10;

  let transactionResult;

  try {
    // Define payloads with native JS arguments
    const payloads = [
      {
        col: 'accounts',
        op: 'updateOne' as const, // Use 'as const' for stricter op typing if desired
        args: [
          { _id: new ObjectId(fromAccountIdString), balance: { $gte: amountToTransfer } }, // filter
          { $inc: { balance: -amountToTransfer } }, // update
        ],
      },
      {
        col: 'accounts',
        op: 'updateOne' as const, // Use 'as const' for stricter op typing if desired
        args: [
          { _id: new ObjectId(toAccountIdString) }, // filter
          { $inc: { balance: amountToTransfer } }, // update
        ],
      },
    ];

    // runTransaction now returns an array of results
    const results = await runTransaction(payloads);

    // Assuming results correspond to payloads in order.
    // For 'updateOne', the result is an UpdateResult object from MongoDB driver.
    const updateFromResult = results[0] as { modifiedCount: number; [key: string]: any }; // Cast for type safety
    const updateToResult = results[1] as { modifiedCount: number; [key: string]: any }; // Cast for type safety

    if (updateFromResult.modifiedCount === 0) {
      throw new Error(
        'Failed to debit from account or insufficient funds.'
      );
    }

    if (updateToResult.modifiedCount === 0) {
      throw new Error('Failed to credit to account.');
    }

    transactionResult = {
      message: 'Transaction successful',
      fromAccount: fromAccountIdString,
      toAccount: toAccountIdString,
      amount: amountToTransfer,
    };
    console.log('Transaction committed via runTransaction.');
    
    return NextResponse.json(transactionResult);

  } catch (e) {
    console.error('Transaction aborted due to an error (via runTransaction):', e);
    // errorHandler will catch this and return an appropriate response
    // Consider if the error `e` from runTransaction provides enough detail
    // or if a more generic transaction error message is needed here.
    return errorHandler(e);
  } 
  // No finally block for session.endSession() needed as runTransaction handles session lifecycle.
}

// Example: To set up initial data for testing this route, you could run:
/*
import { client } from '~/lib/mongo/client-local'; // client needed for setup script
import { ObjectId } from 'mongodb';
import { getCollection } from '@/lib/mongo'; // or use getCollection if preferred for setup

async function setupAccounts() {
  // For setup, direct client usage or getCollection is fine.
  // Using getCollection for consistency with app logic where possible:
  const accountsCollection = getCollection<Account>('accounts');
  
  // Ensure you are in development mode for getCollection to return a direct client collection
  if (process.env.NODE_ENV !== 'development') {
    console.warn('Account setup script is designed for development environment using direct DB access.');
    // Optionally, connect directly if getCollection won't work as expected in prod for setup
    // const db = client.db();
    // const directCollection = db.collection('accounts');
    // await directCollection.deleteMany({}); 
    // ... and so on for insertMany
    return;
  }

  await accountsCollection.deleteMany({}); // Clear existing
  await accountsCollection.insertMany([
    { _id: new ObjectId("682ddb3f83bce78cfb40b09e"), name: "Account A", balance: 100 },
    { _id: new ObjectId("682ddb3f83bce78cfb40b09f"), name: "Account B", balance: 50 },
  ]);
  console.log('Accounts set up');
  // In a standalone script, you might want to close the client if it was explicitly opened.
  // However, if using `getCollection` in dev, client management is handled by `client-local.ts` typically.
  // If client was imported and used directly: await client.close(); 
}

// To run setup: ensure NODE_ENV is development or adjust script for direct client usage.
// setupAccounts().catch(console.error);
*/
