## Introduction
Example showing how to use mongodb with cloudflare workers with durable object for improved speed and reusable connection.
During development, it uses original mongodb api calls without DO as durable object not supported in open-next dev.
All the mongodb files present in `lib/mongo` folder.

Make sure to configure these `.env` variables for mongodb via `wrangler secret put <ENV_NAME>` or via cloudflare dashboard.
```bash
MONGODB_URI=
MONGODB_DB=
```

## DO sharding (optional)
It also support sharding in durable object to bypass 1K/sec limitation although not required. Currently it set to 2 and you can configure the variable on `lib/mongo/index.ts` file (line 58: `NUMBER_OF_DO_SHARDS`)


## Using mongodb transaction
Check `api/hc/route.ts` file for transaction usage.

## Methods supported

- `FindCursor.ts` - Contains the FindCursor class
- `AggregateCursor.ts` - Contains the AggregateCursor class  
- `types.ts` - Contains shared interface definitions

## Basic Usage

```typescript
import { getCollection } from '@/lib/mongo';

const collection = getCollection('myCollection');

// Basic find with cursor methods
const docs = await collection.find({ status: 'active' })
  .limit(10)
  .skip(5)
  .sort({ createdAt: -1 })
  .toArray();

// With projection
const docsWithProjection = await collection.find({ status: 'active' })
  .project({ title: 1, description: 1, _id: 0 })
  .limit(20)
  .toArray();
```

## Aggregation Cursor

```typescript
// Basic aggregation with cursor methods
const results = await collection.aggregate([
  { $match: { status: 'published' } }
])
  .sort({ views: -1 })
  .limit(10)
  .project({ title: 1, views: 1 })
  .toArray();

// Complex aggregation pipeline
const complexResults = await collection.aggregate([
  { $match: { category: 'tech' } }
])
  .group({
    _id: '$author',
    totalViews: { $sum: '$views' },
    articleCount: { $sum: 1 }
  })
  .sort({ totalViews: -1 })
  .limit(5)
  .toArray();

// Using native MongoDB aggregation operators
const lookupResults = await collection.aggregate([
  { $match: { status: 'active' } }
])
  .lookup({
    from: 'users',
    localField: 'authorId', 
    foreignField: '_id',
    as: 'author'
  })
  .unwind('$author')
  .project({
    title: 1,
    'author.name': 1,
    publishedAt: 1
  })
  .sort({ publishedAt: -1 })
  .limit(20)
  .toArray();
```

## Chaining Multiple Methods

```typescript
// Complex query with multiple cursor methods
const result = await collection.find({ category: 'tech' })
  .sort({ publishedAt: -1, views: -1 })
  .skip(10)
  .limit(5)
  .project({ title: 1, summary: 1, views: 1 })
  .toArray();

// Async iteration support
for await (const doc of collection.find({ status: 'active' }).limit(100)) {
  console.log(doc.title);
}
```

## Cursor Options

```typescript
// Using various cursor options
const docs = await collection.find({ status: 'active' })
  .sort({ createdAt: -1 })
  .limit(20)
  .batchSize(5)
  .maxTimeMS(5000)
  .hint({ status: 1, createdAt: -1 })
  .collation({ locale: 'en', strength: 2 })
  .allowDiskUse(true)
  .toArray();

// Aggregation with options
const aggResults = await collection.aggregate([
  { $match: { views: { $gte: 100 } } }
])
  .sort({ views: -1 })
  .limit(10)
  .allowDiskUse(true)
  .maxTimeMS(10000)
  .batchSize(5)
  .toArray();
```

## Available Methods

### FindCursor Methods
- `limit(number)` - Limit the number of documents
- `skip(number)` - Skip a number of documents  
- `sort(sort)` - Sort the results
- `project(projection)` - Select specific fields
- `batchSize(number)` - Set batch size for cursor
- `maxTimeMS(number)` - Set maximum execution time
- `hint(hint)` - Provide index hint
- `collation(collation)` - Set collation options
- `allowDiskUse(boolean)` - Allow disk usage for large sorts
- `toArray()` - Execute and return all results as array
- `next()` - Get next single document
- `count()` - Count matching documents

### AggregateCursor Methods
- `limit($limit)` - Add $limit stage
- `skip($skip)` - Add $skip stage  
- `sort($sort)` - Add $sort stage
- `project($project)` - Add $project stage
- `match($match)` - Add $match stage
- `group($group)` - Add $group stage
- `unwind($unwind)` - Add $unwind stage
- `lookup($lookup)` - Add $lookup stage
- `addStage(stage)` - Add any custom stage
- `out($out)` - Add $out stage
- `redact($redact)` - Add $redact stage
- `geoNear($geoNear)` - Add $geoNear stage
- `batchSize(number)` - Set batch size
- `maxTimeMS(number)` - Set maximum execution time
- `allowDiskUse(boolean)` - Allow disk usage
- `collation(collation)` - Set collation options
- `hint(hint)` - Provide index hint
- `toArray()` - Execute and return all results
- `next()` - Get next single document
- `getPipeline()` - Get copy of current pipeline

Both cursor types support async iteration and all standard MongoDB cursor patterns!