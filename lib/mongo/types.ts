import {
  Document,
  Filter,
  FindOptions,
  AggregateOptions,
  WithId,
} from 'mongodb';

export interface ICollectionProxy<TSchema extends Document = Document> {
  _executeFindWithOptions(filter: Filter<TSchema>, options?: FindOptions): Promise<WithId<TSchema>[]>;
  _executeAggregateWithOptions<TResultDoc extends Document = Document>(pipeline: Document[], options?: AggregateOptions): Promise<TResultDoc[]>;
} 