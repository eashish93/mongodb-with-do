import {
  Document,
  Filter,
  FindOptions,
  Sort,
  WithId,
} from 'mongodb';
import { ICollectionProxy } from './types';

export class FindCursor<TSchema extends Document = Document> {
  private filter: Filter<TSchema>;
  private options: FindOptions = {};
  private collectionProxy: ICollectionProxy<TSchema>;

  constructor(filter: Filter<TSchema>, collectionProxy: ICollectionProxy<TSchema>) {
    this.filter = filter;
    this.collectionProxy = collectionProxy;
  }

  limit(limit: number): FindCursor<TSchema> {
    this.options.limit = limit;
    return this;
  }

  skip(skip: number): FindCursor<TSchema> {
    this.options.skip = skip;
    return this;
  }

  sort(sort: Sort): FindCursor<TSchema> {
    this.options.sort = sort;
    return this;
  }

  project<T extends Document = TSchema>(projection: Document): FindCursor<T> {
    this.options.projection = projection;
    return this as any;
  }

  batchSize(size: number): FindCursor<TSchema> {
    this.options.batchSize = size;
    return this;
  }

  maxTimeMS(ms: number): FindCursor<TSchema> {
    this.options.maxTimeMS = ms;
    return this;
  }

  hint(hint: string | Document): FindCursor<TSchema> {
    this.options.hint = hint;
    return this;
  }

  collation(collation: any): FindCursor<TSchema> {
    this.options.collation = collation;
    return this;
  }

  allowDiskUse(allow: boolean = true): FindCursor<TSchema> {
    this.options.allowDiskUse = allow;
    return this;
  }

  // Execute the find and return array
  async toArray(): Promise<WithId<TSchema>[]> {
    return this.collectionProxy._executeFindWithOptions(this.filter, this.options);
  }

  // Execute and return first document
  async next(): Promise<WithId<TSchema> | null> {
    const results = await this.collectionProxy._executeFindWithOptions(this.filter, { ...this.options, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  // For async iteration support
  async *[Symbol.asyncIterator](): AsyncIterableIterator<WithId<TSchema>> {
    const results = await this.toArray();
    for (const doc of results) {
      yield doc;
    }
  }

  // Count documents matching the cursor filter
  async count(): Promise<number> {
    // This would need to be implemented by calling a count operation
    // For now, we'll get all docs and count them (not optimal but works)
    const results = await this.toArray();
    return results.length;
  }
} 