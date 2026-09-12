import {
  type AuthorSchema,
  authorId as id,
  authorObject as object,
  authorRecord as record,
} from '../contracts/json-author-schema';

const source: AuthorSchema = {
  oneOf: [
    object({ kind: { const: 'score' } }),
    object({ kind: { const: 'resource' }, id }),
    object({ kind: { const: 'inventory' }, id }),
  ],
};

export const jsonCollectionViewComponentSchema: AuthorSchema = object(
  {
    component: { const: 'collection.view' },
    id,
    scope: { enum: ['match', 'round'] },
    groups: record(source),
    total: { oneOf: [{ const: 'sum' }, source] },
  },
  ['component', 'id', 'groups'],
);
