import {
  Document,
  AggregateOptions,
  Sort,
} from 'mongodb';
import { ICollectionProxy } from './types';

export class AggregateCursor<TSchema extends Document = Document> {
  private pipeline: Document[];
  private options: AggregateOptions = {};
  private collectionProxy: ICollectionProxy<any>; // Use any since aggregation can return different types

  constructor(pipeline: Document[], collectionProxy: ICollectionProxy<any>) {
    this.pipeline = pipeline;
    this.collectionProxy = collectionProxy;
  }

  // Add $limit stage to the pipeline
  limit($limit: number): this {
    this.pipeline.push({ $limit });
    return this;
  }

  // Add $skip stage to the pipeline
  skip($skip: number): this {
    this.pipeline.push({ $skip });
    return this;
  }

  // Add $sort stage to the pipeline
  sort($sort: Sort): this {
    this.pipeline.push({ $sort });
    return this;
  }

  // Add $project stage to the pipeline
  project<T extends Document = Document>($project: Document): AggregateCursor<T> {
    this.pipeline.push({ $project });
    return this as any;
  }

  // Add $match stage to the pipeline
  match($match: Document): this {
    this.pipeline.push({ $match });
    return this;
  }

  // Add $group stage to the pipeline
  group<T extends Document = TSchema>($group: Document): AggregateCursor<T> {
    this.pipeline.push({ $group });
    return this as any;
  }

  // Add $unwind stage to the pipeline
  unwind($unwind: Document | string): this {
    this.pipeline.push({ $unwind });
    return this;
  }

  // Add $lookup stage to the pipeline  
  lookup($lookup: Document): this {
    this.pipeline.push({ $lookup });
    return this;
  }

  // Add $addStage method for generic stage addition
  addStage(stage: Document): this;
  addStage<T extends Document = Document>(stage: Document): AggregateCursor<T>;
  addStage<T extends Document = Document>(stage: Document): this | AggregateCursor<T> {
    this.pipeline.push(stage);
    return this as any;
  }

  // Add $out stage to the pipeline
  out($out: { db: string; coll: string } | string): this {
    this.pipeline.push({ $out });
    return this;
  }

  // Add $redact stage to the pipeline
  redact($redact: Document): this {
    this.pipeline.push({ $redact });
    return this;
  }

  // Add $geoNear stage to the pipeline
  geoNear($geoNear: Document): this {
    this.pipeline.push({ $geoNear });
    return this;
  }

  // Set cursor options
  batchSize(size: number): AggregateCursor<TSchema> {
    this.options.batchSize = size;
    return this;
  }

  maxTimeMS(ms: number): AggregateCursor<TSchema> {
    this.options.maxTimeMS = ms;
    return this;
  }

  allowDiskUse(allow: boolean = true): AggregateCursor<TSchema> {
    this.options.allowDiskUse = allow;
    return this;
  }

  collation(collation: any): AggregateCursor<TSchema> {
    this.options.collation = collation;
    return this;
  }

  hint(hint: string | Document): AggregateCursor<TSchema> {
    this.options.hint = hint;
    return this;
  }

  // Execute the aggregation and return array
  async toArray(): Promise<TSchema[]> {
    return this.collectionProxy._executeAggregateWithOptions(this.pipeline, this.options);
  }

  // Execute and return first document
  async next(): Promise<TSchema | null> {
    // Create a new pipeline with $limit: 1
    const limitedPipeline = [...this.pipeline, { $limit: 1 }];
    const results = await this.collectionProxy._executeAggregateWithOptions(limitedPipeline, this.options);
    return results.length > 0 ? results[0] as TSchema : null;
  }

  // For async iteration support
  async *[Symbol.asyncIterator](): AsyncIterableIterator<TSchema> {
    const results = await this.toArray();
    for (const doc of results) {
      yield doc;
    }
  }

  // Add the pipeline to an existing pipeline (useful for complex aggregations)
  getPipeline(): Document[] {
    return [...this.pipeline];
  }
} 